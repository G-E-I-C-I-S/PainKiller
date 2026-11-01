import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { coresClaro, coresEscuro, type Cores } from './tokens';

export type NomeTema = 'escuro' | 'claro';

interface ValorTema {
  nome: NomeTema;
  cores: Cores;
  definir: (nome: NomeTema) => void;
}

const TemaContexto = createContext<ValorTema>({ nome: 'escuro', cores: coresEscuro, definir: () => {} });

export function ProvedorTema({ children }: { children: ReactNode }) {
  // Tema escuro de alto contraste é o padrão (docs/08 · Visão geral).
  const [nome, setNome] = useState<NomeTema>('escuro');

  useEffect(() => {
    SecureStore.getItemAsync('tema').then((v) => {
      if (v === 'claro' || v === 'escuro') setNome(v);
    });
  }, []);

  const definir = (n: NomeTema) => {
    setNome(n);
    SecureStore.setItemAsync('tema', n);
  };

  return (
    <TemaContexto.Provider value={{ nome, cores: nome === 'escuro' ? coresEscuro : coresClaro, definir }}>
      {children}
    </TemaContexto.Provider>
  );
}

export const useTema = () => useContext(TemaContexto);
