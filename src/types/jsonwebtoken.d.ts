declare module "jsonwebtoken" {
  export type SignOptions = {
    expiresIn?: string | number;
  };

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string,
    options?: SignOptions,
  ): string;

  export function verify(token: string, secretOrPublicKey: string): unknown;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}
