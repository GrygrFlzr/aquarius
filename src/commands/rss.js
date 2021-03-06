const Aquarius = require('../aquarius');
const parser = require('parse-rss');

const FREQUENCY = 1000 * 60 * 5;
const CHANNEL_MESSAGE_HISTORY_LIMIT = 50;

class RSS extends Aquarius.Command {
  constructor() {
    super();
    this.description = 'Posts to a channel with new RSS entries. If the URL has not been posted in the past 50 channel messages, it is considered new.';
    this.settings.addKey('channel', null, 'Where to post RSS alerts (no #)');
    this.settings.addKey('url', null, 'Link to RSS Feed');

    setInterval(this.loop.bind(this), FREQUENCY);
  }

  loop() {
    Aquarius.Client.guilds.array().forEach(guild => {
      if (Aquarius.Permissions.isCommandEnabled(guild, this)) {
        this.checkForUpdates(guild);
      }
    });
  }

  checkForPastContent(channel, content, limit = CHANNEL_MESSAGE_HISTORY_LIMIT) {
    return channel.fetchMessages({ limit }).then(messages => {
      const result = messages.array().some(message => message.content.includes(content));
      return result;
    }).catch(err => {
      this.log(err);
      return true; // Assume content has been posted
    });
  }

  checkForUpdates(guild) {
    const url = this.getSetting(guild.id, 'url');
    const target = this.getSetting(guild.id, 'channel');
    const channel = guild.channels.array().find(c => c.name === target);
    
    if (!channel) {
      this.log(`No channel set for ${guild.name}. Exiting`);
      return;
    }

    if (!url) {
      const admin = guild.owner.user;
      this.log(`Alerting ${admin.name} to configure RSS command.`);
      channel.send(`${admin}: Please set a url for the RSS command. Query me with \`help rss\`.`);
      return;
    }

    parser(url, (err, rss) => {
      if (err) {
        if (!this.checkForPastContent(channel, 'Error parsing RSS feed', 1)) {
          channel.send(`Error parsing RSS feed: ${url}`);
        }

        this.log(err);
        return;
      }

      rss.reverse().forEach(entry => {
        this.checkForPastContent(channel, entry.link).then(posted => {
          if (!posted) {
            this.log(`Posting ${entry.title} to ${guild.name}`);
            let str = `📰 **${entry.title}**\n`;
            str += '\n';
            str += `${entry.link}`;
            channel.send(str);
          }
        });
      });
    });
  }
}

module.exports = new RSS();
