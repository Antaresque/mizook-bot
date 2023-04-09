import { DissonanceCommandContext, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";
import { Message } from "discord.js";
import { OCRService } from "../services/OCRService";

@SlashCommand('ss')
export class ScreenshotCommand implements OnCommandInteraction {
    constructor(private ocrService: OCRService) { }

    async register() {
        return {
            name: 'ss',
            description: 'Analyze last image in channel'
        }
    }

    async handle({ interaction }: DissonanceCommandContext) {
        const msgs = await interaction.channel?.messages.fetch({ limit: 10 });

        if(msgs === undefined || msgs.size === 0)
            return;

        const messages = [...msgs].filter(([key, msg]) => !msg.author.bot && (this.isAttachmentImage(msg) || this.isLinkImage(msg.content)) );
        if(messages.length > 0) {
            const msg = messages[0][1];
            const embed = await this.ocrService.handleOCRMessage(msg);
            if(embed === undefined) {
                await interaction.reply({ content: "Unable to find image", ephemeral: true });
                return;
            }
            await interaction.reply({ embeds: embed });
        }
    }

    // ------------

    private isAttachmentImage = (msg: Message<boolean>) => (msg.attachments.size > 0 && this.isImage(msg.attachments.first()!.url));
    private isLinkImage = (url: string) => (url.startsWith("http") && this.isImage(url));
    private isImage = (url: string) => {
        return(url.match(/\.(jpeg|jpg|gif|png|jfif)$/) != null);
    };

}