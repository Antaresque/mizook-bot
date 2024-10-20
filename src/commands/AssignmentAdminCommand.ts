import { DissonanceCommandContext, DissonanceCommandOptionType, DissonanceLogger, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";
import { CommandInteraction, EmbedBuilder, Message } from "discord.js";
import { OCRService } from "../services/OCRService";
import { TesseractOCRService } from "../services/TesseractOCRService";

@SlashCommand('assignment-batch')
export class AssignmentAdminCommand implements OnCommandInteraction {
    constructor(private ocrService: TesseractOCRService, private logger: DissonanceLogger) { }

    async register() {
        return {
            name: 'assignment-batch',
            description: 'Analyzes all images in last 10 posts in the channel (for mods only)',
            options: [{
                name: 'player', description: 'Username of the player (can be empty)', type: DissonanceCommandOptionType.STRING, required: false},{
                name: 'messageCount', description: 'default: 10, please dont abuse this', type: DissonanceCommandOptionType.STRING, required: false
            }]
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
        const msgCount = interaction.options.get('messageCount') ? interaction.options.get('messageCount')?.value as number : 10;
        const msgs = await interaction.channel?.messages.fetch({ limit: Math.min(50, msgCount) });

        if(msgs === undefined || msgs.size === 0)
            return;
        
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply({ content: "Analyzing and submitting the images..." });

        const messages = [...msgs].filter(([key, msg]) => !msg.author.bot && (this.isAttachmentImage(msg) || this.isLinkImage(msg.content)) );
        let embeds: EmbedBuilder[] = [];
        for(let message of messages) {
            const msg = message[1];

            if(msg.attachments.size == 0) {
                const embed = await this.handleForLink(msg, interaction);
                if(embed !== undefined){
                    embeds.push(embed);
                    await interaction.editReply({ embeds: embeds });
                }
            } 
            else {
                const array = await this.handleForAttachments(msg, interaction);
                if(array.length > 0) {
                    embeds = embeds.concat(array);
                    await interaction.editReply({ embeds: embeds });
                }
            }
        }

        if(embeds.length === 0)
            await interaction.editReply({ content: "No content found or not able to read images." });
        else
            await interaction.editReply({ content: "Done analyzing the scores." });
           
    }

    private async handleForLink(msg: Message<boolean>, interaction: CommandInteraction) {
        const playerName = interaction.options.get("player") ? interaction.options.get("player")?.value as string : interaction.user.username;
        
        const embed = await this.ocrService.urlIntoEmbed(msg.content, null, playerName, true);
        return embed;
    }

        
    private async handleForAttachments(msg: Message<boolean>, interaction: CommandInteraction) {
        const playerName = interaction.options.get("player") ? interaction.options.get("player")?.value as string : interaction.user.username;

        const embeds: EmbedBuilder[] = [];
        for(const v of msg.attachments) {
            const attachment = v[1];
            const embed = await this.ocrService.urlIntoEmbed(attachment.url, null, playerName, true);
            if(embed !== undefined)
                embeds.push(embed);
        }   

        return embeds;
    }
}
