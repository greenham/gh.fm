/**
 * GH.FM
 * A discord bot that takes/plays song requests through youtube.
 */
const Discord = require('discord.js');
const Music = require('discord.js-musicbot-addon');
const client = new Discord.Client();
const config = require('./config.json');
//const fallbackStreams = ["ezvTXN6vXRM", "2L9vFNMvIBE", "3KR2S3juSqU", "iUm_9ozEVlk", "NHo7fSJ9ItE"];

const commands = {};

client.on('ready', () => {
	let textChannel = client.channels.find('name', config.textChannelName);
	console.log(`[${new Date()}] ${config.botName} is ready.`);
	textChannel.send(`${config.botName} is ready.`);
});

client.on('message', msg => {
	if (msg.channel.name !== config.textChannelName || !msg.content.startsWith(config.prefix)) return;
	if (commands.hasOwnProperty(msg.content.toLowerCase().slice(config.prefix.length).split(' ')[0]))
		commands[msg.content.toLowerCase().slice(config.prefix.length).split(' ')[0]](msg);
});

client.login(config.d_token);

const music = new Music(client, {
  prefix: config.prefix,
  maxQueueSize: 200,
  clearInvoker: false,
  helpCmd: 'help',
  volumeCmd: 'vol',
  clearCmd: 'clear',
  ownerOverMember: true,
  botOwner: config.adminID,
  youtubeKey: config.youtubeApiKey,
  djRoleName: config.djRoleName
});

// catch Promise errors
process.on('unhandledRejection', console.error);
