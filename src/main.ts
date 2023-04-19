import {
  REST,
  Routes,
  GatewayIntentBits,
  Client,
  Partials,
  SlashCommandBuilder,
  AutocompleteInteraction,
  CommandInteraction,
} from "discord.js";
import dotenv from "dotenv";
import { GuildQueue, Player, QueryType, QueueRepeatMode } from "discord-player";

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("play music")
    .addStringOption((option) =>
      option
        .setName("keyword")
        .setDescription("keyword or url")
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName("next").setDescription("play next track"),
  new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("disconnect this voice channel"),
  new SlashCommandBuilder()
    .setName("repeat")
    .setDescription("change repeatMode"),
  new SlashCommandBuilder().setName("list").setDescription("show status"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
      body: commands,
    });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
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
});

const player = new Player(client);

client.on("interactionCreate", async (interaction) => {
  var autocompleteInteraction = interaction as AutocompleteInteraction;
  var commandInteraction = interaction as CommandInteraction;
  var url = autocompleteInteraction.options.getString("keyword") ?? "not found";
  if (url.match(/https:\/\//)) url = `"${url}"`;
  await commandInteraction.deferReply();

  const queue: GuildQueue = player.nodes.create(
    autocompleteInteraction.guild!,
    {
      volume: 10,
      metadata: {
        channel: interaction.channel,
      },
    }
  );

  switch (autocompleteInteraction.commandName) {
    case "play":
      const track = await player
        .search(url, {
          requestedBy: interaction.user,
          searchEngine: url.match(/https:\/\//)
            ? QueryType.AUTO
            : QueryType.YOUTUBE_SEARCH,
        })
        .then((x) => x.tracks);

      queue.addTrack(track);
      if (!queue.isPlaying()) {
        try {
          await queue.connect(autocompleteInteraction.channelId);
        } catch (e) {
          console.log("ボイスチャンネルに参加できませんでした");
          console.log(e);
        }
        await queue.node.play();

        const interval = setInterval(() => {
          if (!queue.isPlaying()) {
            setTimeout(() => {
              if (queue.deleted) {
                clearInterval(interval);
                setTimeout(() => {
                  commandInteraction.editReply("finished");
                  return;
                }, 2000);
              }
            }, 2000);
          }
          commandInteraction.editReply(
            "Author: " +
              queue.currentTrack?.author +
              "\n" +
              "Title: " +
              queue.currentTrack?.title +
              "\n" +
              "Url: " +
              "<" +
              queue.currentTrack?.url +
              ">" +
              "\n" +
              "RepeatMode: " +
              QueueRepeatMode[queue.node.queue.repeatMode] +
              "\n" +
              queue.node.createProgressBar() ?? "finished"
          );
        }, 1000);
      }
      break;
    case "next":
      commandInteraction.deleteReply();
      queue.node.skip();
      break;
    case "disconnect":
      commandInteraction.deleteReply();
      queue.delete();
      queue.connection?.disconnect();
      break;
    case "repeat":
      commandInteraction.deleteReply();
      if (queue.node.queue.repeatMode == QueueRepeatMode.OFF) {
        queue.node.queue.setRepeatMode(QueueRepeatMode.QUEUE);
      } else {
        queue.node.queue.setRepeatMode(QueueRepeatMode.OFF);
      }
      break;
    case "list":
      let titles = queue.tracks
        .map((track, index) => {
          let title = track.title.trim();
          return (
            (index + 1).toString().padStart(2, " ") +
            " : " +
            title.substring(0, 18)
          );
        })
        .join("\n");
      commandInteraction.editReply("```" + titles + "```");
  }
});

client.login(process.env.TOKEN);
