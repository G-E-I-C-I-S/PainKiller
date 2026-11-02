// Agendamento: gera as rondas das agendas para os próximos dias e marca como NAO_REALIZADA a que passou da janela sem começar.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Banco, novoId } from '../nucleo/base';
import { diaDaSemana, diaLocal, localParaUtc, somarDias } from '../nucleo/tempo';

const DIAS_A_FRENTE = 2;
const INTERVALO_MS = 5 * 60_000;

@Injectable()
export class Agendamento implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private db: Banco) {}

  onModuleInit() {
    const ciclo = () => this.gerar().catch((e) => console.error('agendamento', e));
    void ciclo();
    this.timer = setInterval(ciclo, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async criarRonda(p: { roteiroId: string; vigilanteId: string; inicio: Date; duracaoMin: number; toleranciaInicioMin: number; agendaId: string | null }) {
    const roteiro = await this.db.roteiro.findUniqueOrThrow({ where: { id: p.roteiroId }, include: { pontos: { orderBy: { ordem: 'asc' } } } });
    // Cópia do roteiro na ronda: mudar o roteiro depois não altera rondas já geradas.
    return this.db.ronda.create({
      data: {
        id: novoId(), campusId: roteiro.campusId, roteiroId: roteiro.id, roteiroNome: roteiro.nome, exigeOrdem: roteiro.exigeOrdem,
        vigilanteId: p.vigilanteId, agendaId: p.agendaId, inicioPrevisto: p.inicio, fimPrevisto: new Date(p.inicio.getTime() + p.duracaoMin * 60_000),
        toleranciaInicioMin: p.toleranciaInicioMin,
        pontos: { create: roteiro.pontos.map((x) => ({ pontoRondaId: x.pontoRondaId, ordem: x.ordem, obrigatorio: x.obrigatorio })) },
      },
    });
  }

  /** Mudou ou desativou a agenda: cancela as rondas futuras que ainda não começaram (as novas são geradas de novo). */
  async cancelarFuturas(agendaId: string, usuarioId: string) {
    await this.db.ronda.updateMany({
      where: { agendaId, status: 'AGENDADA', inicioPrevisto: { gt: new Date() } },
      data: { status: 'CANCELADA', canceladaEm: new Date(), canceladaPorId: usuarioId },
    });
  }

  async gerar() {
    const agora = new Date();
    await this.db.ronda.updateMany({ where: { status: 'AGENDADA', fimPrevisto: { lt: agora } }, data: { status: 'NAO_REALIZADA' } });
    const agendas = await this.db.agenda.findMany({ where: { ativo: true, roteiro: { ativo: true }, vigilante: { ativo: true } }, include: { roteiro: { include: { campus: true } } } });
    for (const a of agendas) {
      const fuso = a.roteiro.campus.fuso;
      const hoje = diaLocal(agora, fuso);
      for (let i = 0; i <= DIAS_A_FRENTE; i++) {
        const dia = somarDias(hoje, i);
        if (!a.diasSemana.includes(diaDaSemana(dia))) continue;
        const inicio = localParaUtc(dia, a.horaInicio, fuso);
        if (inicio.getTime() + a.duracaoMin * 60_000 < agora.getTime()) continue;
        if (await this.db.ronda.findFirst({ where: { agendaId: a.id, inicioPrevisto: inicio, status: { not: 'CANCELADA' } } })) continue;
        await this.criarRonda({ roteiroId: a.roteiroId, vigilanteId: a.vigilanteId, inicio, duracaoMin: a.duracaoMin, toleranciaInicioMin: a.toleranciaInicioMin, agendaId: a.id }).catch(() => {});
      }
    }
  }
}
