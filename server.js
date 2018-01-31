/**
 * GH.FM
 * A discord bot that takes/plays song requests through youtube.
 */
const Discord = require('discord.js');
const Music = require('discord.js-musicbot-addon');
const client = new Discord.Client();
const config = require('./config.json');
const fallbackStreams = ["ezvTXN6vXRM", "2L9vFNMvIBE", "3KR2S3juSqU"];

client.on('ready', () => {
	let textChannel = client.channels.find('name', config.discord.textChannelName);
	console.log(`[${new Date()}] ${config.botName} is ready.`);
  if (config.discord.enableStartupMessage) {
	 textChannel.send(`${config.botName} is ready.`);
  }
}).login(config.discord.token);

const music = new Music(client, {
  prefix: config.cmdPrefix,
  maxQueueSize: 200,
  clearInvoker: false,
  helpCmd: 'help',
  volumeCmd: 'vol',
  clearCmd: 'clear',
  ownerOverMember: true,
  botOwner: config.discord.adminID,
  youtubeKey: config.youtube.apiKey,
  djRoleName: config.discord.djRoleName,
  livestreams: fallbackStreams,
  subsonic: config.subsonic
});
