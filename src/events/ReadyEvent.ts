import { DiscordClient, DissonanceLogger, Event } from "@antaresque/dissonance";

@Event('ready')
export class ReadyEvent {
    constructor(private logger: DissonanceLogger) {}

    handle(client: DiscordClient) {
        this.logger.log(`Logged in as ${client?.user?.tag}!`);
    }
}