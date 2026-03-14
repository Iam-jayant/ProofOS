declare module "@fileverse/agents" {
  export class Agent {
    constructor(config: unknown);
    setupStorage(namespace: string): Promise<void>;
    writeMarkdown(
      markdownContent: string,
      options?: { title?: string },
    ): Promise<{ url?: string; ipfsHash?: string }>;
  }
}

declare module "@fileverse/agents/storage" {
  export class PinataStorageProvider {
    constructor(config: { jwt: string; gateway?: string });
  }
}
