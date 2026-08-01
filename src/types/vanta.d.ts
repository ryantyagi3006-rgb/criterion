declare module "vanta/dist/vanta.halo.min" {
  export type VantaEffect = {
    destroy: () => void;
    setOptions: (options: Record<string, unknown>) => void;
    resize: () => void;
  };
  const HALO: (options: Record<string, unknown>) => VantaEffect;
  export default HALO;
}
