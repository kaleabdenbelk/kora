export async function createContext() {
  return {
    session: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
