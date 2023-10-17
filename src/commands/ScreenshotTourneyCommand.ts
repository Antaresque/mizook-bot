import { DissonanceCommandContext, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";
import { CommandInteraction, EmbedBuilder, Message } from "discord.js";
import { OCRService } from "../services/OCRService";

@SlashCommand('t-ocr')
export class ScreenshotTourneyCommand implements OnCommandInteraction {
    constructor(private ocrService: OCRService) { }

    async register() {
        return {
            name: 't-ocr',
            description: 'Read data from coop tourney screenshot(s)'
        }
    }

    private isAttachmentImage = (msg: Message<boolean>) => (msg.attachments.size > 0 && this.isImage(msg.attachments.first()!.url));
    private isLinkImage = (url: string) => (url.startsWith("http") && this.isImage(url));
    private isImage = (url: string) => {
        return(url.match(/\.(jpeg|jpg|gif|png|jfif)$/) != null);
    };

    async handle({ interaction }: DissonanceCommandContext) {
        const msgs = await interaction.channel?.messages.fetch({ limit: 10 });

        if(msgs === undefined || msgs.size === 0)
            return;

        const messages = [...msgs].filter(([key, msg]) => !msg.author.bot && (this.isAttachmentImage(msg) || this.isLinkImage(msg.content)) );
        if(messages.length > 0) {
            const msg = messages[0][1];

            if(msg.attachments.size == 0) 
                return await this.handleForLink(msg, interaction);
            else 
                return await this.handleForAttachments(msg, interaction);
        }
    }

    private async handleForLink(msg: Message<boolean>, interaction: CommandInteraction) {
        const embed = await this.ocrService.urlIntoTourneyEmbed(msg.content);
        if(embed === undefined) {
            await interaction.reply({ content: "Unable to find image", ephemeral: true });
            return;
        }

        await interaction.reply({ embeds: [embed] });
    }

        
    private async handleForAttachments(msg: Message<boolean>, interaction: CommandInteraction) {
            
        const embeds: EmbedBuilder[] = [];
        for(const v of msg.attachments) {
            const attachment = v[1];
            const embed = await this.ocrService.urlIntoTourneyEmbed(attachment.url);
            if(embed !== undefined)
                embeds.push(embed);
        }   

        if(embeds === undefined) {
            await interaction.reply({ content: "Unable to find image", ephemeral: true });
            return;
        }
        await interaction.reply({ embeds: embeds });
    }
}