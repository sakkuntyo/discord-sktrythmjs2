import { REST, Routes, GatewayIntentBits, Client, Partials, Message, SlashCommandBuilder, AutocompleteInteraction, CommandInteraction } from 'discord.js';
import dotenv from 'dotenv';
import { GuildQueue, Player, QueryType} from 'discord-player';

dotenv.config()

const commands = [
    new SlashCommandBuilder()
      .setName('rythm')
      .setDescription('play music')
      .addStringOption(option =>
        option.setName('url')
        .setDescription('youtube url')
        .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('next')
      .setDescription('play next track'),
    new SlashCommandBuilder()
      .setName('disconnect')
      .setDescription('disconnect this voice channel'),
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
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
  ],
  partials: [Partials.Message, Partials.Channel],
})

const player = new Player(client);

client.on('interactionCreate', async interaction => {
    var commandInteraction = interaction as AutocompleteInteraction;
    var url = commandInteraction.options.getString("url") ?? "not found";
    (interaction as CommandInteraction).deferReply();

    const queue:GuildQueue = player.nodes.create(commandInteraction.guild!, {
      volume: 10,
      metadata: {
        channel: interaction.channel,
      },
    });

    switch (commandInteraction.commandName){
      case "rythm":
        const track = await player
        .search(url, {
          requestedBy: interaction.user,
          searchEngine: QueryType.AUTO,
        })
        .then((x) => x.tracks);

        queue.addTrack(track);
        if (!queue.isPlaying()) {
          try {
              await queue.connect(commandInteraction.channelId);
          } catch (e){
              console.log("ボイスチャンネルに参加できませんでした")
              console.log(e)
          }
          await queue.node.play();
          setInterval(() => {
            (interaction as CommandInteraction).editReply(queue.node.createProgressBar() ?? "createProgressBar failed");
          }, 1000);
        }
        break;
      case "next":
        queue.node.skip();
        break;
      case "disconnect":
        queue.connection?.disconnect();
        break;
    }
})

client.login(process.env.TOKEN)
