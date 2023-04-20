import {
  REST,
  Routes,
  GatewayIntentBits,
  Client,
  Partials,
  SlashCommandBuilder,
  AutocompleteInteraction,
  CommandInteraction,
  EmbedBuilder
} from 'discord.js';
import dotenv from 'dotenv';
import {
  GuildQueue,
  Player,
  QueryType,
  QueueRepeatMode,
  Track
} from 'discord-player';

import { Queue } from '@discord-player/utils';

import { lyricsExtractor } from '@discord-player/extractor';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('play music')
    .addStringOption(option =>
      option
        .setName('keyword')
        .setDescription('keyword or url')
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName('next').setDescription('play next track'),
  new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('disconnect this voice channel'),
  new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('change repeatMode'),
  new SlashCommandBuilder().setName('list').setDescription('show list'),
  new SlashCommandBuilder().setName('shuffle').setDescription('shuffle list'),
  new SlashCommandBuilder().setName('history').setDescription('show history'),
  new SlashCommandBuilder().setName('lyric').setDescription('show lyric'),
  new SlashCommandBuilder()
    .setName('eval')
    .setDescription('eval')
    .addStringOption(option =>
      option.setName('command').setDescription('command').setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
      body: commands
    });
    console.log('Successfully reloaded application (/) commands.');
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
    GatewayIntentBits.AutoModerationExecution
  ],
  partials: [Partials.Message, Partials.Channel]
});

const player = new Player(client);

client.on('interactionCreate', async interaction => {
  var url =
    (interaction as AutocompleteInteraction).options.getString('keyword') ??
    'not found';
  var command =
    (interaction as AutocompleteInteraction).options.getString('command') ??
    'not found';
  await (interaction as CommandInteraction).deferReply();

  const queue: GuildQueue = player.nodes.create(
    (interaction as AutocompleteInteraction).guild!,
    {
      volume: 10,
      metadata: {
        channel: interaction.channel
      }
    }
  );

  switch ((interaction as AutocompleteInteraction).commandName) {
    case 'play':
      const track = await player
        .search(url, {
          requestedBy: interaction.user,
          searchEngine: url.match(/https:\/\//)
            ? QueryType.AUTO
            : QueryType.YOUTUBE_SEARCH
        })
        .then(x => x.tracks);

      queue.addTrack(track);
      if (!queue.isPlaying()) {
        try {
          await queue.connect(
            (interaction as AutocompleteInteraction).channelId
          );
        } catch (e) {
          console.log('ボイスチャンネルに参加できませんでした');
          console.log(e);
        }
        await queue.node.play();

        const interval = setInterval(() => {
          if (!queue.isPlaying()) {
            setTimeout(() => {
              if (queue.deleted) {
                clearInterval(interval);
                setTimeout(() => {
                  (interaction as CommandInteraction).editReply('終了しました');
                  return;
                }, 2000);
              }
            }, 2000);
          }
          (interaction as CommandInteraction).editReply(
            'Author: ' +
              queue.currentTrack?.author +
              '\n' +
              'Title: ' +
              queue.currentTrack?.title +
              '\n' +
              'Url: ' +
              '<' +
              queue.currentTrack?.url +
              '>' +
              '\n' +
              'RepeatMode: ' +
              QueueRepeatMode[queue.repeatMode] +
              '\n' +
              queue.node
                .createProgressBar()
                ?.replace(/▬/, '')
                .replace(/▬/, '')
                .replace(/▬(?!.▬)/, '')
                .replace(/▬(?!.▬)/, '') ?? '終了したかも'
          );
        }, 1000);
      }
      break;
    case 'next':
      (interaction as CommandInteraction).deleteReply();
      queue.node.skip();
      queue.currentTrack;
      break;
    case 'disconnect':
      (interaction as CommandInteraction).deleteReply();
      queue.delete();
      queue.connection?.disconnect();
      break;
    case 'repeat':
      (interaction as CommandInteraction).deleteReply();
      if (queue.repeatMode == QueueRepeatMode.OFF) {
        queue.setRepeatMode(QueueRepeatMode.QUEUE);
      } else {
        queue.setRepeatMode(QueueRepeatMode.OFF);
      }
      break;
    case 'list':
      (interaction as CommandInteraction).editReply('再生リスト' + '\n');
      let embades = queue.tracks.map((track, index) => {
        return new EmbedBuilder()
          .setTitle(track.title)
          .setURL(track.url)
          .setThumbnail(track.thumbnail)
          .setDescription(track.title)
          .setColor('Red');
      });

      embades.forEach(embad => {
        interaction.channel!.send({ embeds: [embad] });
      });

      // let titles = getTrackNames(queue.tracks).join('\n');
      // (interaction as CommandInteraction).editReply(
      //   '再生リスト' + '\n' + '```' + titles + '```'
      // );
      break;
    case 'shuffle':
      queue.tracks.shuffle();
      (interaction as CommandInteraction).editReply('シャッフルしました');
      break;
    case 'history':
      let history = getTrackNames(queue.history.tracks).join('\n');
      (interaction as CommandInteraction).editReply(
        '再生履歴' + '\n' + '```' + history + '```'
      );
      break;
    case 'lyric':
      const lyricsFinder = lyricsExtractor('token');

      var lyrics = await lyricsFinder
        .search('踊 ado japanese')
        .catch(() => null);

      lyrics = lyrics!;

      const trimmedLyrics = lyrics.lyrics.substring(0, 1997);

      (interaction as CommandInteraction).editReply('歌詞');

      const embed = new EmbedBuilder()
        .setTitle(lyrics.title)
        .setURL(lyrics.url)
        .setThumbnail(lyrics.thumbnail)
        .setAuthor({
          name: lyrics.artist.name,
          iconURL: lyrics.artist.image,
          url: lyrics.artist.url
        })
        .setDescription(
          trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics
        )
        .setColor('Yellow');
      interaction.channel!.send({ embeds: [embed] });
      break;
    case 'eval':
      if ((interaction as CommandInteraction).user.id != 'id') {
        (interaction as CommandInteraction).editReply('権限がありません');
        break;
      }
      try {
        eval(command);
      } catch (e) {
        console.log(e);
      } finally {
        (interaction as CommandInteraction).editReply(command);
      }
      break;
  }
});

client.login(process.env.TOKEN);

function getTrackNames(tracks: Queue<Track>): string[] {
  if (tracks.size === 0) return ['なし'];
  return tracks.map((track, index) => {
    let title = track.title.trim();
    return (
      (index + 1).toString().padStart(2, ' ') + ' : ' + title.substring(0, 18)
    );
  });
}
