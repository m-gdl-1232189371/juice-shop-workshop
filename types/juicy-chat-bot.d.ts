declare module "juicy-chat-bot" {
  type TrainingState = {
    state: boolean;
  };

  type ChatResponse = {
    action: string;
    body?: unknown;
    handler?: string;
  };

  export class Bot {
    constructor(
      name: string,
      greeting: string,
      trainingSet: string,
      defaultResponse: string
    );
    training: TrainingState;
    factory: { run(command: string): unknown };
    train(): Promise<void>;
    addUser(id: string, name: string): void;
    greet(id: string): string;
    respond(query: string, userId: string): Promise<ChatResponse>;
  }
}
