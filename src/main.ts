import { REST, Routes, GatewayIntentBits, Client, Partials, Message, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js';
import dotenv from 'dotenv';
import { Player, QueryType} from 'discord-player';

dotenv.config()

const commands = [
    new SlashCommandBuilder()
      .setName('rythm')
      .setDescription('play music')
      .addStringOption(option =>
        option.setName('url')
        .setDescription('youtube url')
        .setRequired(true)
      )
].map(command => command.toJSON());
  
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

(async () => {
try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
} catch (error) {
    console.error(error);
}
})();

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
})

const player = new Player(client);

client.on('interactionCreate', async interaction => {
    var commandInteraction = interaction as AutocompleteInteraction;
    var url = commandInteraction.options.getString("url") ?? "not found";

    const queue = player.nodes.create(commandInteraction.guild!, {
        metadata: {
          channel: interaction.channel,
        },
      });

    const track = await player
    .search(url, {
      requestedBy: interaction.user,
      searchEngine: QueryType.YOUTUBE_VIDEO,
    })
    .then((x) => x.tracks[0]);

    queue.addTrack(track);

    try {
        await queue.connect(commandInteraction.channelId);
    } catch (e){
        console.log("ボイスチャンネルに参加できませんでした")
        console.log(e)
    }

    await queue.node.play();
})

client.login(process.env.TOKEN)