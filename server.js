/**
 * GH.FM
 * A discord bot that takes/plays song requests through youtube.
 */
const { Client } = require('discord.js');
const yt = require('ytdl-core');
const tokens = require('./tokens.json');
const client = new Client();
// @todo use channels instead of specific streams and search/find streams on-the-fly
const fallbackStreams = ["ezvTXN6vXRM", "2L9vFNMvIBE", "3KR2S3juSqU", "iUm_9ozEVlk"];
let playSettings = {volume: 0.5, passes: tokens.passes};

let queue = {};

const commands = {
	'play': (msg) => {
		if (queue[msg.guild.id] === undefined || queue[msg.guild.id].length === 0) {
			// no songs in the queue right now, pick randomly from some known livestreams
			return msg.channel.send(`Queue is empty, add songs with ${tokens.prefix}add (playing from livestreams until then)`).then(() => {
			  let livestream = fallbackStreams[Math.floor(Math.random()*fallbackStreams.length)];
				msg.content = `!add ${livestream}`;
				commands.add(msg).then(() => {
					queue[msg.guild.id].playing = false;
					queue[msg.guild.id].livestreamMode = true;
					commands.play(msg);
				}).catch(console.error);
			});
		}

		// connect to the default voice channel if not already connected
		// @todo try connecting to the user's voice channel first
		if (!msg.guild.voiceConnection) return commands.join(tokens.voiceChannelName).then(() => commands.play(msg));

		// make sure it's not already playing
		if (queue[msg.guild.id].playing) return msg.channel.send('Already Playing');
		queue[msg.guild.id].playing = true;

		let dispatcher;

		(function play(song) {
			console.log(song);
			if (song === undefined) {
				queue[msg.guild.id].playing = false;
				queue[msg.guild.id].livestreamMode = false;
				return msg.channel.send(`Queue is empty, add more songs with ${tokens.prefix}add, or play a random livestream with ${tokens.prefix}play`);
			}
			msg.channel.send(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), playSettings);
			let collector = msg.channel.createCollector(m => m);
			collector.on('message', m => {
				let userIsDJ = (m.author.id == tokens.adminID) || (m.member.roles.find('name', tokens.djRoleName));
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					if (m.author.username == song.requester || userIsDJ) {
						msg.channel.send(`Paused current song, use ${tokens.prefix}resume to unpause.`).then(() => {dispatcher.pause();});
					} else {
						msg.channel.send('Only the requester or a DJ can do that.');
					}
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					if (m.author.username == song.requester || userIsDJ) {
						msg.channel.send('Resumed').then(() => {dispatcher.resume();});
					} else {
						msg.channel.send('Only the requester or a DJ can do that.');
					}
				} else if (m.content.startsWith(tokens.prefix + 'skip')){
					if (m.author.username == song.requester || userIsDJ || queue[m.guild.id].livestreamMode === true) {
						msg.channel.send('Skipped current song.').then(() => {
							queue[m.guild.id].livestreamMode = false;
							dispatcher.end();
						});
					} else {
						msg.channel.send('Only the requester or a DJ can do that right now.');
					}
				} else if (m.content.startsWith('volume+') && m.author.id == tokens.adminID){
					if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-') && m.author.id == tokens.adminID){
					if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(tokens.prefix + 'time')){
					msg.channel.send(`Current song time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				} else if (m.content.startsWith(tokens.prefix + 'current')) {
					// @todo send DM to author of message instead of the channel
					msg.channel.send(`Current song playing on ${tokens.voiceChannelName}: ${song.videoUrl}`);
				}
			});
			dispatcher.on('end', () => {
				collector.stop();
				play(queue[msg.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return msg.channel.send('error: ' + err).then(() => {
					collector.stop();
					play(queue[msg.guild.id].songs.shift());
				});
			});
		})(queue[msg.guild.id].songs.shift());
	},
	'join': (voiceChannelName) => {
		return new Promise((resolve, reject) => {
			const voiceChannel = client.channels.find('name', voiceChannelName);
			if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply(`I couldn't connect to the '${voiceChannelName}' voice channel, please check permissions.`);
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'add': (msg) => {
		return new Promise((resolve, reject) => {
			let url = msg.content.split(' ')[1];
			if (url == '' || url === undefined) {
				msg.channel.send(`You must add a YouTube video url or id after ${tokens.prefix}add`).then(() => reject(Error('No URL included')));
			}
			// @todo support playlist addition
			// @todo support start time parameter (seek)
			yt.getInfo(url, (err, info) => {
				if (err || !info || typeof info === 'undefined') {
					msg.channel.send('Invalid YouTube Link: ' + err).then(() => reject(err));
				}

				// set up the queue if it isn't yet
				if (!queue.hasOwnProperty(msg.guild.id)) {
					queue[msg.guild.id] = {},
					queue[msg.guild.id].playing = false,
					queue[msg.guild.id].songs = [],
					queue[msg.guild.id].livestreamMode = false;
				}

				// add the new song to the queue
				info.title = info.title || 'Untitled';
				queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username, videoUrl: info.video_url});
				msg.channel.send(`Added **${info.title}** to the queue`);

				if (queue[msg.guild.id].livestreamMode === true) {
					msg.channel.send('Currently in livestream mode -- use !skip to go to next song in queue');
				}

				resolve(info);
			});
		});
	},
	'remove': (msg) => {
		if (msg.author.id == tokens.adminID) {
			if (queue[msg.guild.id] === undefined) return msg.channel.send(`No songs are currently queued.`);
			let queueId = msg.content.split(' ')[1];
			let index = (queueId == '' || queueId === undefined) ? (songs.length - 1) : (queueId - 1);
			let removeSong = queue[msg.guild.id].songs.splice(index, 1);
			if (removeSong !== undefined) {
				msg.channel.send(`Removed **${removeSong.title} from the queue`);
			}
		} else {
			msg.reply('Only an admin can do that.');
		}
	},
	'queue': (msg) => {
		if (queue[msg.guild.id] === undefined) {
			return msg.channel.send(`Add some songs to the queue first with ${tokens.prefix}add or just use ${tokens.prefix}play to queue up a random livestream.`);
		}

		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		msg.channel.send(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);

		if (queue[msg.guild.id].livestreamMode === true) {
			msg.channel.send('Currently in livestream mode -- use !skip to go to next song in queue');
		}
	},
	'help': (msg) => {
		let tosend = ['```xl', tokens.prefix + 'add : "Add a valid youtube link to the queue"', tokens.prefix + 'queue : "Shows the current queue, up to 15 songs shown."', tokens.prefix + 'play : "Play the music queue if already joined to a voice channel"', '', 'The following commands only function while the play command is running:'.toUpperCase(), tokens.prefix + 'pause : "Pauses the music"',	tokens.prefix + 'resume : "Resumes the music"', tokens.prefix + 'skip : "Skips the playing song"', tokens.prefix + 'time : "Shows the playtime of the current song."', '```'];
		msg.channel.send(tosend.join('\n'));
	},
	'reboot': (msg) => {
		if (msg.author.id == tokens.adminID) {
			msg.channel.send('Restarting...').then(process.exit());
		} else {
			msg.channel.send('Only the admin is allowed to do that.');
		}
	}
};

client.on('ready', () => {
	// join the designated voice channel
	commands.join(tokens.voiceChannelName).then(connection => {
		let textChannel = client.channels.find('name', tokens.textChannelName);
		console.log('Connected to ' + tokens.voiceChannelName);
		textChannel.send('Connected to ' + tokens.voiceChannelName);
	}).catch(console.error);
});

client.on('message', msg => {
	if (msg.channel.name !== tokens.textChannelName || !msg.content.startsWith(tokens.prefix)) return;
	if (commands.hasOwnProperty(msg.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]))
		commands[msg.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]](msg);
});

client.login(tokens.d_token);

function dmUser(originalMessage, newMessage)
{
  //console.log(originalMessage.member);
  // check that this isn't already a DM before sending
  if (originalMessage.channel.type === 'dm') {
    originalMessage.channel.send(newMessage);
  } else if (originalMessage.member !== undefined && typeof originalMessage.message.createDM !== undefined) {
    originalMessage.member.createDM()
      .then(channel => {channel.send(newMessage);})
      .catch(console.error);
  } else {
  	console.error('no member found for DM');
  }
}

// catch Promise errors
process.on('unhandledRejection', console.error);