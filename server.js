const { Client } = require('discord.js');
const yt = require('ytdl-core');
const tokens = require('./tokens.json');
const client = new Client();
const fallbackStreams = ["TDvV0J8JtPA", "MWZiKbWcVVQ", "g557asb1mRk", "7y7CLWArdFY"];

let queue = {};

const commands = {
	'play': (msg) => {
		if (queue[msg.guild.id] === undefined) {
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
		if (!msg.guild.voiceConnection) return commands.join(tokens.voiceChannelName).then(() => commands.play(msg));
		if (queue[msg.guild.id].playing) return msg.channel.send('Already Playing');
		let dispatcher;
		queue[msg.guild.id].playing = true;

		(function play(song) {
			console.log(song);
			if (song === undefined) {
				return msg.channel.send(`Queue is empty, add more songs with ${tokens.prefix}add (playing from livestreams until then)`).then(() => {
					// no songs in the queue right now, pick randomly from some known livestreams
				  let livestream = fallbackStreams[Math.floor(Math.random()*fallbackStreams.length)];
					msg.content = `!add ${livestream}`;
					commands.add(msg).then(() => {
						queue[msg.guild.id].playing = false;
						queue[msg.guild.id].livestreamMode = true;
						commands.play(msg);
					}).catch(console.error);
				});
			}
			msg.channel.send(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : tokens.passes });
			let collector = msg.channel.createCollector(m => m);
			collector.on('message', m => {
				//console.log(m);
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					if (m.author.username == song.requester || m.author.id == tokens.adminID) {
						msg.channel.send('paused').then(() => {dispatcher.pause();});
					} else {
						msg.channel.send('only the requester or an admin can do that');
					}
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					if (m.author.username == song.requester || m.author.id == tokens.adminID) {
						msg.channel.send('resumed').then(() => {dispatcher.resume();});
					} else {
						msg.channel.send('only the requester or an admin can do that');
					}
				} else if (m.content.startsWith(tokens.prefix + 'skip')){
					if (m.author.username == song.requester || m.author.id == tokens.adminID || queue[m.guild.id].livestreamMode === true) {
						msg.channel.send('skipped').then(() => {
							queue[m.guild.id].livestreamMode = false;
							dispatcher.end();
						});
					} else {
						msg.channel.send('only the requester or an admin can do that');
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
					msg.channel.send(`time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
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
	'join': () => {
		return new Promise((resolve, reject) => {
			const voiceChannel = client.channels.find('name', tokens.voiceChannelName);
			if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply('I couldn\'t connect to your voice channel...');
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'add': (msg) => {
		return new Promise((resolve, reject) => {
			let url = msg.content.split(' ')[1];
			if (url == '' || url === undefined) {
				msg.channel.send(`You must add a YouTube video url, or id after ${tokens.prefix}add`).then(() => reject(Error('No URL included')));
			}
			// @todo support playlist addition
			yt.getInfo(url, (err, info) => {
				if (err) {
					msg.channel.send('Invalid YouTube Link: ' + err).then(() => reject(err));
				}
				if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [], queue[msg.guild.id].livestreamMode = false;
				queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username, videoUrl: info.video_url});
				msg.channel.send(`added **${info.title}** to the queue`);
				if (queue[msg.guild.id].livestreamMode === true) {
					msg.channel.send('currently in livestream mode -- use !skip to go to next song in queue');
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
				msg.channel.send(`removed **${removeSong.title} from the queue`);
			}
		} else {
			msg.reply('Only an admin can do that.');
		}
	},
	'queue': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.send(`Add some songs to the queue first with ${tokens.prefix}add or just use ${tokens.prefix}play to queue up a random livestream.`);
		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		msg.channel.send(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	},
	'help': (msg) => {
		let tosend = ['```xl', tokens.prefix + 'add : "Add a valid youtube link to the queue"', tokens.prefix + 'queue : "Shows the current queue, up to 15 songs shown."', tokens.prefix + 'play : "Play the music queue if already joined to a voice channel"', '', 'the following commands only function while the play command is running:'.toUpperCase(), tokens.prefix + 'pause : "pauses the music"',	tokens.prefix + 'resume : "resumes the music"', tokens.prefix + 'skip : "skips the playing song"', tokens.prefix + 'time : "Shows the playtime of the song."', '```'];
		msg.channel.send(tosend.join('\n'));
	},
	'reboot': (msg) => {
		if (msg.author.id == tokens.adminID) process.exit(); //Requires a node module like Forever to work.
	}
};

client.on('ready', () => {
	// join the designated voice channel
	commands.join().then(connection => console.log('Connected to ' + tokens.voiceChannelName)).catch(console.error);
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