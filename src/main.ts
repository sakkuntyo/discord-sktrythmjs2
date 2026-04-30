import {
  REST,
  Routes,
  GatewayIntentBits,
  Client,
  Partials,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import dotenv from 'dotenv';
import {
  AudioFilters,
  GuildQueue,
  Player,
  QueryType,
  QueueRepeatMode,
  Track,
  type FiltersName
} from 'discord-player';

// アプリケーション情報
import * as fs from 'fs'
const appname = JSON.parse(
  fs.readFileSync("./package.json", "utf8")
).name;
const homepage = JSON.parse(
  fs.readFileSync("./package.json", "utf8")
).homepage;
const version = JSON.parse(
  fs.readFileSync("./package.json", "utf8")
).version;

import { Queue } from '@discord-player/utils';

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
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('single or multi, default multi')
        .setChoices(
          { name: 'single', value: 'single' },
          { name: 'multi', value: 'multi' }
        )
    ),
  new SlashCommandBuilder()
    .setName('bass')
    .setDescription('set bass boost for upcoming tracks')
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('1=off 2-10=stronger bass')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
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
  new SlashCommandBuilder().setName('version').setDescription('show version'),
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

client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

export class Debugger {
    constructor(public client: Client) {
        console.log(client instanceof Client); // logs false
    }
}

const player = new Player(client);
const guildBassLevels = new Map<string, number>();
const customBassFilters = defineCustomBassFilters();

let youtubeiReady: Promise<void> | null = null;

function ensureYouTubeiExtractor(): Promise<void> {
  youtubeiReady ??= registerYouTubeiExtractor();
  return youtubeiReady;
}

async function registerYouTubeiExtractor(): Promise<void> {
  const importYoutubei = new Function(
    'return import("discord-player-youtubei")'
  ) as () => Promise<typeof import('discord-player-youtubei')>;
  const { YoutubeiExtractor } = await importYoutubei();

  await player.extractors.register(YoutubeiExtractor, {
    disablePlayer: true,
    useYoutubeDL: true,
    dlUpdateInterval: 604800000,
    logLevel: 'LOW',
    streamOptions: {
      useClient: 'ANDROID',
      highWaterMark: 1 << 25
    }
  });
}

player.events.on('error', (_queue, error) => {
  console.error('Discord Player queue error:', error);
});

player.events.on('playerError', (_queue, error, track) => {
  console.error('Discord Player stream error:', {
    track: track?.title,
    url: track?.url,
    error
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !(interaction.isButton() && interaction.customId == "add") && !interaction.isModalSubmit()) return;

  var CommandName = ''
  var url = 'not found'
  var trackType = 'multi';
  let bassLevel: number | null = null;
  if (interaction.isChatInputCommand()) {
      await interaction.deferReply();
      CommandName = interaction.commandName;
      url = interaction.options.getString('keyword') ?? 'not found';
      trackType = interaction.options.getString('type') ?? 'multi';
      bassLevel = interaction.options.getInteger('level');
  }
  if (interaction.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId('addmodal')
        .setTitle('曲の追加');
      const keywordInput = new TextInputBuilder()
        .setCustomId('keywordInput')
        .setLabel("追加したい曲のキーワードかURLを入力してください。")
        .setStyle(TextInputStyle.Paragraph);
      const firstActionRow = new ActionRowBuilder<TextInputBuilder>
      firstActionRow.addComponents(keywordInput);
      modal.addComponents(firstActionRow);
      await interaction.showModal(modal);
      return;
  }

  const queue: GuildQueue = player.nodes.create(interaction.guild!, {
    volume: 10,
    defaultFFmpegFilters: getBassFilters(getBassLevel(interaction.guildId)),
    metadata: {
      channel: interaction.channel
    }
  });
  applyBassFilterDefaults(queue, interaction.guildId);

  if (interaction.isModalSubmit()) {
      await interaction.deferReply();
      CommandName = 'play';
      url = interaction.fields.getTextInputValue('keywordInput');
      trackType = 'single';
      if (!queue.isPlaying()) {
        interaction.editReply("追加ボタンは接続中のみ機能します。 /play コマンドを使用してください。");
        return;
      }
  }

  switch (CommandName) {
    case 'bass':
      if (!interaction.guildId || bassLevel === null) {
        interaction.editReply('Bass level could not be updated.');
        break;
      }

      guildBassLevels.set(interaction.guildId, bassLevel);
      applyBassFilterDefaults(queue, interaction.guildId);
      interaction.editReply(
        `Bass filter is set to ${getBassLevelName(
          bassLevel
        )}. It will apply from the next track.`
      );
      break;
    case 'play':
      try {
        await ensureYouTubeiExtractor();
      } catch (error) {
        console.error('Failed to register YouTubei extractor:', error);
        interaction.editReply('YouTube 再生の初期化に失敗しました。ログを確認してください。');
        break;
      }

      const member =
        interaction.guild?.members.cache.get(interaction.user.id) ??
        (await interaction.guild?.members
          .fetch(interaction.user.id)
          .catch(() => undefined));
      const voiceChannel = member?.voice.channel;

      if (!queue.isPlaying() && !voiceChannel) {
        interaction.editReply('先にボイスチャンネルに入ってから /play してください');
        break;
      }

      const searchResult = await player.search(url, {
          requestedBy: interaction.user,
          searchEngine: url.match(/https:\/\//)
            ? QueryType.AUTO
            : QueryType.YOUTUBE_SEARCH
        });
      const track = trackType == 'single' ? searchResult.tracks[0] : searchResult.tracks;

      if (!track || (Array.isArray(track) && track.length === 0)) {
        interaction.editReply('曲が見つかりませんでした');
        break;
      }

      queue.addTrack(track);
      if (queue.isPlaying()) {
        interaction.editReply('追加しました');
        break;
      }
      interaction.editReply('----------------');
      var seekchat = await interaction.channel?.send(
        '開始中...' + '\n' + '----------------'
      );

      try {
        if (!queue.connection && voiceChannel) {
          await queue.connect(voiceChannel);
        }
      } catch (e) {
        console.log('ボイスチャンネルに参加できませんでした');
        console.log(e);
        interaction.editReply('ボイスチャンネルに参加できませんでした');
        queue.delete();
        break;
      }
      try {
        await queue.node.play();
      } catch (e) {
        console.error('Failed to start playback:', e);
        interaction.editReply('再生できませんでした。別のURLまたはキーワードで試してください。');
        queue.delete();
        break;
      }

      let action = new ActionRowBuilder<ButtonBuilder>().setComponents([
        //new ButtonBuilder()
        //  .setCustomId('back')
        //  .setStyle(ButtonStyle.Primary)
        //  .setEmoji('⏮'),
        new ButtonBuilder()
          .setCustomId('repeat')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔁'),
        new ButtonBuilder()
          .setCustomId('shuffle')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔀'),
        new ButtonBuilder()
          .setCustomId('skip')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏭'),
        new ButtonBuilder()
          .setCustomId('add')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➕')
      ]);
      let buttonchat = await interaction.channel?.send({
        components: [action]
      });

      const interval = setInterval(() => {
        if (!queue.isPlaying()) {
          setTimeout(() => {
            if (queue.deleted) {
              clearInterval(interval);
              setTimeout(() => {
                seekchat?.edit('終了しました' + '\n' + '----------------');
                buttonchat?.delete(); //動作するがなぜかエラーが出る DiscordAPIError[10008]: Unknown Message
                return;
              }, 2000);
            }
          }, 2000);
        }
        seekchat?.edit(
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
            getRepeatModeName(queue.repeatMode) +
            '\n' +
            (queue.node
              .createProgressBar()
              ?.replace(/▬/, '')
              .replace(/▬/, '')
              .replace(/▬(?!.▬)/, '')
              .replace(/▬(?!.▬)/, '') +
              '\n' +
              '----------------') +
            '\n' +
            '再生リスト' +
            '\n' +
            '```' +
            getTrackNames(queue.tracks).slice(0,10).join('\n') +
            '```'
        );
      }, 3000);
      break;
    case 'next':
      interaction.deleteReply();
      queue.node.skip();
      break;
    case 'disconnect':
      interaction.deleteReply();
      queue.delete();
      queue.connection?.disconnect();
      break;
    case 'repeat':
      interaction.deleteReply();
      if (queue.repeatMode == QueueRepeatMode.OFF) {
        queue.setRepeatMode(QueueRepeatMode.QUEUE);
      } else {
        queue.setRepeatMode(QueueRepeatMode.OFF);
      }
      break;
    case 'list':
      let titles = getTrackNames(queue.tracks).join('\n');
      interaction.editReply('再生リスト' + '\n' + '```' + titles + '```');
      break;
    case 'shuffle':
      queue.tracks.shuffle();
      interaction.editReply('シャッフルしました');
      break;
    case 'history':
      let history = getTrackNames(queue.history.tracks).join('\n');
      interaction.editReply('再生履歴' + '\n' + '```' + history + '```');
      break;
    case 'version':
      interaction.editReply(`name: ${appname}\nversion: ${version}\n${homepage}`);
      break;
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton() || interaction.customId == 'add') return;

	await interaction.deferReply();

  const queue: GuildQueue = player.nodes.create(interaction.guild!, {
    volume: 10,
    defaultFFmpegFilters: getBassFilters(getBassLevel(interaction.guildId)),
    metadata: {
      channel: interaction.channel
    }
  });
  applyBassFilterDefaults(queue, interaction.guildId);

  switch (interaction.customId) {
    case 'skip':
      //console.log(queue);
      interaction.deleteReply();
      queue.node.skip();
      break;
    case 'repeat':
      interaction.deleteReply();
      if (queue.repeatMode == QueueRepeatMode.OFF) {
        queue.setRepeatMode(QueueRepeatMode.QUEUE);
      } else {
        queue.setRepeatMode(QueueRepeatMode.OFF);
      }
      break;
    case 'shuffle':
      //console.log(queue);
      interaction.deleteReply();
      queue.tracks.shuffle();
      break;
    case 'back':
      interaction.deleteReply();
      queue.history.back();
      break;
    default:
      interaction.editReply('不明なコマンドです');
  }
});

client.login(process.env.TOKEN);
//client.on('debug',console.log); // debug 用

function getRepeatModeName(mode: QueueRepeatMode): string {
  switch (mode) {
    case QueueRepeatMode.TRACK:
      return 'TRACK';
    case QueueRepeatMode.QUEUE:
      return 'QUEUE';
    case QueueRepeatMode.AUTOPLAY:
      return 'AUTOPLAY';
    default:
      return 'OFF';
  }
}

function getBassLevel(guildId: string | null): number {
  if (!guildId) return 1;
  return guildBassLevels.get(guildId) ?? 1;
}

function getBassFilters(level: number): FiltersName[] {
  if (level <= 1) return [];
  const filterName = customBassFilters[level] ?? customBassFilters[10];
  return filterName ? [filterName as FiltersName] : [];
}

function applyBassFilterDefaults(queue: GuildQueue, guildId: string | null): void {
  queue.filters.ffmpeg.setDefaults(getBassFilters(getBassLevel(guildId)));
}

function getBassLevelName(level: number): string {
  if (level <= 1) return 'off';
  return `level ${level}`;
}

function defineCustomBassFilters(): Record<number, string> {
  const filters: Record<number, string> = {};

  for (let level = 2; level <= 10; level++) {
    const gain = (level - 1) * 2;
    const filterName = `bass_custom_${level}`;
    AudioFilters.define(filterName, `bass=g=${gain}`);
    filters[level] = filterName;
  }

  return filters;
}

function getTrackNames(tracks: Queue<Track>): string[] {
  if (tracks.size === 0) return ['なし'];
  return tracks.map((track, index) => {
    let authorRegExp = new RegExp('(【|\\[|\\\s|\/)*(' + track.author + ')(】|\\]|\\\s|\/)*');
    //console.log(authorRegExp)
    let title = track.title.replace(authorRegExp, '').trim();
    return (
      (index + 1).toString().padStart(2, ' ') + ' : ' + title.substring(0, 18)
    );
  });
}
