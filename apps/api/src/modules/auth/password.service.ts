import { Injectable, OnModuleInit } from '@nestjs/common';
import { hash, parseOptions, verify } from '@node-rs/argon2';

// Algorithm is left at the library default (Argon2id); the Algorithm const enum cannot be inlined by SWC.
export const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Numeric values of the library's const enums (Algorithm.Argon2id, Version.V0x13).
const ARGON2ID = 2;
const VERSION_0x13 = 1;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash: Promise<string> | undefined;

  async onModuleInit(): Promise<void> {
    await this.getDummyHash();
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hash('offwise-dummy-password');
    return this.dummyHash;
  }

  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  /** With a null hash, verifies against a dummy hash (equal timing) and returns false. */
  async verify(hashed: string | null, plain: string): Promise<boolean> {
    if (hashed === null) {
      await verify(await this.getDummyHash(), plain);
      return false;
    }
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  }

  needsRehash(hashed: string): boolean {
    try {
      const o = parseOptions(hashed);
      return (
        (o.algorithm as number) !== ARGON2ID ||
        (o.version as number) !== VERSION_0x13 ||
        o.memoryCost !== ARGON2_OPTIONS.memoryCost ||
        o.timeCost !== ARGON2_OPTIONS.timeCost ||
        o.parallelism !== ARGON2_OPTIONS.parallelism
      );
    } catch {
      return true;
    }
  }
}
