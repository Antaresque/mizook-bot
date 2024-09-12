import { EmbedService } from '../services/EmbedService';
import { DissonanceCommandContext, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";
import { CommandInteraction, EmbedBuilder, Message } from "discord.js";
import { OCRService } from "../services/OCRService";
import { TesseractOCRService } from "../services/TesseractOCRService";

@SlashCommand('t-ocr')
export class ScreenshotTourneyCommand implements OnCommandInteraction {
    constructor(private ocrService: TesseractOCRService, private embedService: EmbedService) { }

    async register() {
        return {
            name: 't-ocr',
            description: 'Read data from coop tourney screenshot(s)'
        }
    }

    private isAttachmentImage = (msg: Message<boolean>) => (msg.attachments.size > 0 && this.isImage(msg.attachments.first()!.url));
    private isLinkImage = (url: string) => (url.startsWith("http") && this.isImage(url));
    private isImage = (url: string) => {
        //return(url.match(/\.(jpeg|jpg|gif|png|jfif)$/) != null);
        return true;
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
        await interaction.deferReply({ ephemeral: true });

        const data = await this.ocrService.urlIntoData(msg.content);
        if(data?.dataCoop === undefined) {
            await interaction.editReply({ content: "Unable to find image"});
            return;
        }

        const content = this.embedService.generateCoopRaw(data?.dataCoop);
        if(content === undefined) {
            await interaction.editReply({ content: "Unable to find image"});
            return;
        }

        await interaction.editReply({ content: "```" + content + "```"});
    }

        
    private async handleForAttachments(msg: Message<boolean>, interaction: CommandInteraction) {
        await interaction.deferReply({ ephemeral: true }); 

        let embeds: string = "```";
        for(const v of msg.attachments) {
            const attachment = v[1];
            const data = await this.ocrService.urlIntoData(attachment.url);
            if(data?.dataCoop === undefined)
                continue;
            const content = this.embedService.generateCoopRaw(data.dataCoop);
            if(content !== undefined)
                embeds += content;
        }   

        if(embeds === undefined) {
            await interaction.editReply({ content: "Unable to find image"});
            return;
        }
        await interaction.editReply({ content: embeds + "```" });
    }
}