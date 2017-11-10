/**
 * GH.FM
 * A discord bot that takes/plays song requests through youtube.
 */
const fs = require('fs');
const { Client } = require('discord.js');
const yt = require('ytdl-core');
const config = require('./config.json');
const client = new Client();
const fallbackStreams = ["ezvTXN6vXRM", "2L9vFNMvIBE", "3KR2S3juSqU", "iUm_9ozEVlk", "NHo7fSJ9ItE"];
let playSettings = {volume: 0.5, passes: config.passes};

let queue = {};

const commands = {
	'play': (msg) => {
		// connect to the user's voice channel if not already connected somewhere
		if (!msg.guild.voiceConnection) {
			if (msg.member.voiceChannel) {
				return commands.join(msg).then(() => commands.play(msg));
			} else {
				return msg.channel.send('You must connect to a voice channel before you can play music!');
			}
		}

		// handle non-existent/empty queue
		if (queue[msg.guild.id] === undefined || queue[msg.guild.id].songs.length === 0) {
			// pick randomly from some known livestreams
			return msg.channel.send(`Queue is empty, add songs with \`${config.prefix}add\` (playing from livestreams until then)`).then(() => {
			  let livestream = fallbackStreams[Math.floor(Math.random()*fallbackStreams.length)];
				msg.content = `!add ${livestream}`;
				commands.add(msg).then(() => {
					queue[msg.guild.id].playing = false;
					queue[msg.guild.id].livestreamMode = true;
					commands.play(msg);
				}).catch(console.error);
			});
		}

		// make sure it's not already playing
		if (queue[msg.guild.id].playing) return msg.channel.send('Already Playing');

		let dispatcher;

		(function play(song) {
			//console.log(song);
			// handle empty queue
			if (song === undefined) {
				queue[msg.guild.id].playing = false;
				queue[msg.guild.id].livestreamMode = false;
				msg.channel.send(`Queue is empty, add more songs with \`${config.prefix}add\`, or play a random livestream with \`${config.prefix}play\``);

				// disconnect from voice if not already
				if (msg.guild.voiceConnection) {
					msg.guild.voiceConnection.disconnect();
				}

				return;
			}

			// start playing
			msg.channel.send(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			dispatcher = msg.guild.voiceConnection.playStream(
				yt(song.url, {filter: 'audioonly'}),
				{
					volume: queue[msg.guild.id].volume,
					passes: playSettings.passes,
					seek: song.seek
				}
			);

			// listen to messages while we're playing
			let collector = msg.channel.createMessageCollector(m => m.content.startsWith(config.prefix));
			collector.on('collect', m => {
				let userIsDJ = (m.author.id == config.adminID) || (m.member.roles.find('name', config.djRoleName));
				if (m.content.startsWith(config.prefix + 'pause')) {
					if (m.author.username == song.requester || userIsDJ) {
						msg.channel.send(`Paused current song, use ${config.prefix}resume to unpause.`).then(() => {dispatcher.pause();});
					} else {
						msg.channel.send('Only the requester or a DJ can do that.');
					}
				} else if (m.content.startsWith(config.prefix + 'resume')) {
					if (m.author.username == song.requester || userIsDJ) {
						msg.channel.send('Resumed').then(() => {dispatcher.resume();});
					} else {
						msg.channel.send('Only the requester or a DJ can do that.');
					}
				} else if (m.content.startsWith(config.prefix + 'skip')) {
					if (m.author.username == song.requester || userIsDJ || queue[m.guild.id].livestreamMode === true) {
						msg.channel.send('Skipped current song.').then(() => {
							queue[m.guild.id].livestreamMode = false;
							dispatcher.end();
						});
					} else {
						msg.channel.send('Only the requester or a DJ can do that right now.');
					}
				} else if (m.content.startsWith(config.prefix + 'vol')) {
					// handle all volume commands here
					let currentVolume = Math.round(dispatcher.volume*50);
					let newVolume = currentVolume;
					if (m.content === `${config.prefix}vol`) {
						msg.channel.send(`Current Volume: ${currentVolume}%`);
					} else if (m.content.startsWith(config.prefix + 'vol-bg') && userIsDJ) {
						newVolume = 0.25;
						dispatcher.setVolume(newVolume);
						msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					} else if (m.content.startsWith(config.prefix + 'vol-default') && userIsDJ) {
						newVolume = 0.5;
						dispatcher.setVolume(0.5);
						msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					} else if (m.content.startsWith(config.prefix + 'vol-loud') && userIsDJ) {
						newVolume = 1;
						dispatcher.setVolume(newVolume);
						msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					} else if (m.content.startsWith(config.prefix + 'vol+') && userIsDJ) {
						if (currentVolume >= 100) return msg.channel.send(`Volume: ${currentVolume}%`);
						newVolume = Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50, 2);
						dispatcher.setVolume(newVolume);
						msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					} else if (m.content.startsWith(config.prefix + 'vol-') && userIsDJ) {
						if (currentVolume <= 0) return msg.channel.send(`Volume: ${currentVolume}%`);
						newVolume = Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50, 0);
						dispatcher.setVolume(newVolume);
						msg.channel.send(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					}
					// persist volume through queue changes
					queue[msg.guild.id].volume = newVolume;
				} else if (m.content.startsWith(config.prefix + 'time')){
					msg.channel.send(`Current song time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				} else if (m.content.startsWith(config.prefix + 'current')) {
					// @todo send DM to author of message instead of the channel
					msg.channel.send(`Current song playing on ${config.botName}: ${song.videoUrl}`);
				}
			});

			// handle stream events
			dispatcher.on('start', () => {
				queue[msg.guild.id].playing = true;
			}).on('end', () => {
				collector.stop();
				queue[msg.guild.id].playing = false;
				play(queue[msg.guild.id].songs.shift());
			}).on('error', (err) => {
				return msg.channel.send('error: ' + err).then(() => {
					collector.stop();
				});
			});
		})(queue[msg.guild.id].songs.shift());
	},
	'join': (msg) => {
		return new Promise((resolve, reject) => {
			if (msg.guild.voiceConnection) {
				reject(`I'm already connected to a voice channel!`);
			}
			const voiceChannel = msg.member.voiceChannel;
			if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply(`You're not connected a voice channel!`);
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'leave': (msg) => {
		return new Promise((resolve, reject) => {
			if (!msg.guild.voiceConnection) {
				reject(`Not connected to a voice channel!`);
			}
			// empty the queue before DC
			queue[msg.guild.id] = initQueue(playSettings.volume);
			msg.guild.voiceConnection.disconnect();
		});
	},
	'add': (msg) => {
		return new Promise((resolve, reject) => {
			let url = msg.content.split(' ')[1];
			if (url == '' || url === undefined) {
				msg.channel.send(`You must add a YouTube video url or id after ${config.prefix}add`).then(() => reject(Error('No URL included')));
			}
			
			yt.getInfo(url, (err, info) => {
				if (err || !info || typeof info === 'undefined') {
					msg.channel.send('Invalid YouTube Link: ' + err).then(() => reject(err));
				}

				// set up the queue if it isn't yet
				if (!queue.hasOwnProperty(msg.guild.id)) {
					queue[msg.guild.id] = initQueue(playSettings.volume);
				}

				// check if seek time was requested
				let seek = 0;
				if (/t\=\d+/.test(url) === true) {
					seek = url.match(/t\=(\d+)/)[1];
				}

				// add the new song to the queue
				info.title = info.title || 'Untitled';
				queue[msg.guild.id].songs.push(
					{
						url: url,
						title: info.title,
						requester: msg.author.username,
						videoUrl: info.video_url,
						seek: seek
					}
				);
				msg.channel.send(`Added **${info.title}** to the queue`);

				if (queue[msg.guild.id].livestreamMode === true) {
					msg.channel.send('Currently in livestream mode -- use !skip to go to next song in queue');
				}

				resolve(info);
			});
		});
	},
	'remove': (msg) => {
		if (msg.author.id == config.adminID) {
			if (queue[msg.guild.id] === undefined) return msg.channel.send(`No songs are currently queued.`);
			let queueId = msg.content.split(' ')[1];
			let index = (queueId == '' || queueId === undefined) ? (songs.length - 1) : (queueId - 1);
			let removeSong = queue[msg.guild.id].songs.splice(index, 1);
			if (removeSong !== undefined) {
				msg.channel.send(`Removed **${removeSong.title}** from the queue`);
			}
		} else {
			msg.reply('Only an admin can do that.');
		}
	},
	'clear': (msg) => {
		if (msg.author.id == config.adminID) {
			if (queue[msg.guild.id] === undefined) return msg.channel.send(`No songs are currently queued.`);
			queue[msg.guild.id] = initQueue(playSettings.volume);
			msg.channel.send(`Queue has been cleared.`);
		} else {
			msg.reply('Only an admin can do that.');
		}
	},
	'queue': (msg) => {
		if (queue[msg.guild.id] === undefined) {
			return msg.channel.send(`Add some songs to the queue first with ${config.prefix}add or just use ${config.prefix}play to queue up a random livestream.`);
		}

		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		msg.channel.send(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);

		if (queue[msg.guild.id].livestreamMode === true) {
			msg.channel.send('Currently in livestream mode -- use !skip to go to next song in queue');
		}
	},
	'help': (msg) => {
		let tosend = ['```xl', config.prefix + 'join : "Tells the bot to join your voice channel"', config.prefix + 'add : "Add a valid youtube link to the queue"', config.prefix + 'queue : "Shows the current queue, up to 15 songs shown."', config.prefix + 'play : "Play the music queue if already joined to a voice channel"', '', 'The following commands only function while the play command is running:'.toUpperCase(), config.prefix + 'pause : "Pauses the music"',	config.prefix + 'resume : "Resumes the music"', config.prefix + 'skip : "Skips the playing song"', config.prefix + 'time : "Shows the playtime of the current song."', '```'];
		msg.channel.send(tosend.join('\n'));
	},
	'reboot': (msg) => {
		if (msg.author.id == config.adminID) {
			msg.channel.send('Restarting...').then(process.exit());
		} else {
			msg.channel.send('Only the admin is allowed to do that.');
		}
	}
};

client.on('ready', () => {
	let textChannel = client.channels.find('name', config.textChannelName);
	console.log(`${config.botName} is ready.`);
	textChannel.send(`${config.botName} is ready. Connect to any voice channel and use \`${config.prefix}add\` to queue up some songs or \`${config.prefix}play\` to start playing from a livestream immediately.`);
});

client.on('message', msg => {
	if (msg.channel.name !== config.textChannelName || !msg.content.startsWith(config.prefix)) return;
	if (commands.hasOwnProperty(msg.content.toLowerCase().slice(config.prefix.length).split(' ')[0]))
		commands[msg.content.toLowerCase().slice(config.prefix.length).split(' ')[0]](msg);
});

client.login(config.d_token);

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

function initQueue(volume)
{
	return {
		playing: false,
		songs: [],
		livestreamMode: false,
		volume: volume
	};
}

// catch Promise errors
process.on('unhandledRejection', console.error);
