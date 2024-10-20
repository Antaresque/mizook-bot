import { DissonanceCommandContext, DissonanceCommandOptionType, DissonanceLogger, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";
import { CommandInteraction, EmbedBuilder, Message } from "discord.js";
import { OCRService } from "../services/OCRService";
import { TesseractOCRService } from "../services/TesseractOCRService";

@SlashCommand('assignment')
export class AssignmentCommand implements OnCommandInteraction {
    constructor(private ocrService: TesseractOCRService, private logger: DissonanceLogger) { }

    async register() {
        return {
            name: 'assignment',
            description: 'Analyze and submit last image(s) post in the channel'
        }
    }

    private isAttachmentImage = (msg: Message<boolean>) => (msg.attachments.size > 0 && this.isImage(msg.attachments.first()!.url));
    private isLinkImage = (url: string) => (url.startsWith("http") && this.isImage(url));
    private isImage = (url: string) => {
        //return(url.match(/\.(jpeg|jpg|gif|png|jfif)$/) != null);
        // temporary acceptance of all images (unnecessary)
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
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply({ content: "Analyzing and submitting the images..." });

        const playerName = interaction.user.username;
        
        const embed = await this.ocrService.urlIntoEmbed(msg.content, null, playerName, true);
        if(embed === undefined) {
            await interaction.editReply({ content: "Unable to find or read image." });
            return;
        }

        await interaction.editReply({ content: "Data analyzed", embeds: [embed] });
    }

        
    private async handleForAttachments(msg: Message<boolean>, interaction: CommandInteraction) {
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply({ content: "Analyzing and submitting the images..." });

        const playerName = interaction.user.username;

        const embeds: EmbedBuilder[] = [];
        for(const v of msg.attachments) {
            const attachment = v[1];
            const embed = await this.ocrService.urlIntoEmbed(attachment.url, null, playerName, true);
            if(embed !== undefined)
                embeds.push(embed);
        }   

        if(embeds.length === 0) {
            await interaction.editReply({ content: "Unable to find or read image." });
            return;
        }
        await interaction.editReply({ content: "Data analyzed", embeds: [...embeds] });
    }
}
