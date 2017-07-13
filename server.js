const { Client } = require('discord.js');
const yt = require('ytdl-core');
const tokens = require('./tokens.json');
const client = new Client();
const fallbackStreams = ["TDvV0J8JtPA", "MWZiKbWcVVQ", "g557asb1mRk", "7y7CLWArdFY"];

let queue = {};

const commands = {
	'play': (msg) => {
		if (queue[msg.guild.id] === undefined) {
			// pick randomly from some known livestreams
		  let stream = fallbackStreams[Math.floor(Math.random()*items.length)];
		  commands.play(stream);
			return msg.channel.sendMessage('No songs in the queue, playing random live stream...');
		}
		if (!msg.guild.voiceConnection) return commands.join(tokens.voiceChannelName).then(() => commands.play(msg));
		if (queue[msg.guild.id].playing) return msg.channel.sendMessage('Already Playing');
		let dispatcher;
		queue[msg.guild.id].playing = true;

		(function play(song) {
			console.log(song);
			if (song === undefined) return msg.channel.sendMessage(`Queue is empty, add more songs with ${tokens.prefix}add`).then(() => {
				// pick randomly from some known livestreams
			  let stream = fallbackStreams[Math.floor(Math.random()*items.length)];
			  commands.play(stream);
			});
			msg.channel.sendMessage(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : tokens.passes });
			let collector = msg.channel.createCollector(m => m);
			collector.on('collect', function(m, c) {
				console.log(m);
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					if (m.author.username == song.requester || m.author.id == tokens.adminID) {
						msg.channel.sendMessage('paused').then(() => {dispatcher.pause();});
					} else {
						msg.channel.send('only the requester or an admin can do that');
					}
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					if (m.author.username == song.requester || m.author.id == tokens.adminID) {
						msg.channel.sendMessage('resumed').then(() => {dispatcher.resume();});
					} else {
						msg.channel.send('only the requester or an admin can do that');
					}
				} else if (m.content.startsWith(tokens.prefix + 'skip') && (m.author.username == song.requester || m.author.id == tokens.adminID)){
					msg.channel.sendMessage('skipped').then(() => {dispatcher.end();});
				} else if (m.content.startsWith('volume+') && m.author.id == tokens.adminID){
					if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-') && m.author.id == tokens.adminID){
					if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(tokens.prefix + 'time')){
					msg.channel.sendMessage(`time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				} else if (m.content.startsWith(tokens.prefix + 'current')) {
					// send DM to author with link to current song
					//dmUser(m, song.videoUrl);
					msg.channel.sendMessage('Current song: ' + song.videoUrl);
				}
			});
			dispatcher.on('end', () => {
				collector.stop();
				play(queue[msg.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return msg.channel.sendMessage('error: ' + err).then(() => {
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
		let url = msg.content.split(' ')[1];
		if (url == '' || url === undefined) return msg.channel.sendMessage(`You must add a YouTube video url, or id after ${tokens.prefix}add`);
		// @todo support playlist addition
		yt.getInfo(url, (err, info) => {
			if(err) return msg.channel.sendMessage('Invalid YouTube Link: ' + err);
			if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [];
			queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username, videoUrl: info.video_url});
			msg.channel.sendMessage(`added **${info.title}** to the queue`);
		});
	},
	'remove': (msg) => {
		if (msg.author.id == tokens.adminID) {
			if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`No songs are currently queued.`);
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
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Add some songs to the queue first with ${tokens.prefix}add`);
		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		msg.channel.sendMessage(`__**${msg.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	},
	'help': (msg) => {
		let tosend = ['```xl', tokens.prefix + 'add : "Add a valid youtube link to the queue"', tokens.prefix + 'queue : "Shows the current queue, up to 15 songs shown."', tokens.prefix + 'play : "Play the music queue if already joined to a voice channel"', '', 'the following commands only function while the play command is running:'.toUpperCase(), tokens.prefix + 'pause : "pauses the music"',	tokens.prefix + 'resume : "resumes the music"', tokens.prefix + 'skip : "skips the playing song"', tokens.prefix + 'time : "Shows the playtime of the song."', '```'];
		msg.channel.sendMessage(tosend.join('\n'));
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