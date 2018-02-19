const Discord = require('discord.js')
const fs = require('fs')
const winston = require('winston')
const MESSAGE = Symbol.for('message')
const DateFormat = require('date.format')

const jsonFormatter = (logEntry) => {
    const base = {"@timestamp": new Date()}
    const json = Object.assign(base, logEntry)
    logEntry[MESSAGE] = JSON.stringify(json)
    return logEntry
}

const log = winston.createLogger({
    level: 'info',
    format: winston.format(jsonFormatter)(),
    transports: [
        new winston.transports.File({
            filename: 'log.log',
            timestamp: true
        })
    ]
})

const client = new Discord.Client()
const config = JSON.parse(fs.readFileSync('./config.json'))
const global_wall = JSON.parse(fs.readFileSync('./global.json'))
const CODE_MARKUP = '```'

global.botClient = client

const STAR_EMOJI = '\u2B50'
const NO_MOUTH_EMOJI = '😶'
const UPVOTE_EMOJI = '🔼'
const DOWNVOTE_EMOJI = '🔽'

class WOFBotDJS {

    initialize() {
        try {
            client.login(fs.readFileSync('./login.key', 'utf-8'))

            client.on('ready', () => {
                log.info("Connected to discord")
                this.updateAllServers()

                setInterval(() => this.updateAllServers, 5 * 1000)
            })

            client.on('guildCreate', guild => {
                log.info("Joined new server: " + guild.name)
                this.registerServer(guild)
            })

            client.on('guildDelete', guild => {
                log.info("Removed from server: " + guild.name)
                this.serverRemoved(guild)
            })

            client.on('message', message => {
                this.handleMessage(message)
            })

            client.on('messageReactionAdd', message => {
                this.handleReaction(message)
            })
        } catch (ex) {
            log.error('The application had a fatal error', ex)
        }
    }

    registerServer(server) {
        this.checkAndCreateChannel(server)
                .then(() => {
                    const serverConfig = config[server.id]

                    if (!serverConfig) {
                        this.initialSetup(server)
                    }
                })
    }

    initialSetup(server) {
        config[server.id] =
                {
                    wall_content: [],
                    prefix: '-',
                    react_threshold: 5,
                    react_emoji: STAR_EMOJI,
                    global_subscribe: true
                }

        this.updateWallOnServer(server)

        this.saveConfigFile()
        this.sendGreeting(server)
    }

    handleMessage(message) {
        if (message.author.bot) {
            return
        }

        const server = message.guild
        const channel = message.channel

        try {
            const prefix = config[server.id].prefix
            const isCommand = message.content.substring(0, 1) === prefix

            if (isCommand) {
                const commandString = message.content.replace(prefix, '')
                let args = commandString.split(' ')
                const command = args[0]
                args = args.splice(1, args.length)

                log.info("User issed command: " + command)

                switch (command) {
                    case 'help':
                        this.showHelp(channel)
                        break
                    case 'prefix':
                        const newPrefix = args[0]

                        if (args.length == 0) {
                            message.react(NO_MOUTH_EMOJI)
                            channel.send('^ Your prefix can be seen here...')
                            break
                        }

                        if (newPrefix.length === 1) {
                            this.updatePrefix(server, newPrefix)
                            channel.send(`Prefix has been changed to **${newPrefix}**`)
                        } else {
                            channel.send(`Prefix can only be one character. e.g. **${prefix}**`)
                        }

                        break
                    case 'threshold':
                        const newThreshold = args[0]

                        if (newThreshold > 1 && newThreshold < 50) {
                            this.updateThreshold(server, newThreshold)
                            channel.send(`Updated server threshold to: **${newThreshold}**`)
                        }else{
                            channel.send('New threshold must be within the range 1-50')
                        }
                }
            }
        } catch (ex) {
            log.error('There was an error parsing a command', ex)
            channel.send(`There was an error with your syntax. Try **${prefix}help**`)
        }
    }

    updateThreshold(server, newThreshold) {
        config[server.id].react_threshold = newThreshold
        this.saveConfigFile()
    }

    handleReaction(messageReaction) {
        let message = messageReaction.message

        for (let react of message.reactions.values()) {
            const server = message.guild
            const serverConfig = config[server.id]

            const threshold = serverConfig.react_threshold
            const emoji = serverConfig.react_emoji

            if (react.count == threshold && react.emoji.name === emoji) {
                this.saveAndAddToWall(message, server)
            }
        }
    }

    saveAndAddToWall(message, server) {
        this.checkAndCreateChannel(server)

        const wall = config[server.id].wall_content

        const wall_item = {
            message: message.content,
            author: message.author,
            timestamp: message.createdTimestamp,
            upvotes: 0,
            downvotes: 0,
            server_name: server.name
        }

        wall.push(wall_item)
        global_wall.push(wall_item)

        this.saveGlobalWall()
        this.saveConfigFile()

        this.addToWall(server, wall_item)
    }

    addToWall(server, message) {
        this.checkAndCreateChannel(server)
                .then(wallOfFame => {
                    const embed = new Discord.RichEmbed()
                    embed.addField(message.author, message.message)
                    embed.setFooter(`⬆️ ${message.upvotes} ⬇️ ${message.downvotes} (${new Date(message.timestamp).format("hh:MM dd/mm/yy")})`)
                    return wallOfFame.send(embed)
                }).catch(log.error)
    }

    updateAllServers() {
        for (let server of client.guilds.values()) {
            this.updateWallOnServer(server)
        }
    }

    updateWallOnServer(server) {
        this.checkAndCreateChannel(server)
                .then(wallOfFame => {
                    wallOfFame.clone()
                        .then(newWall => {
                            wallOfFame.delete().then(() => {
                                newWall.send('**This is the Wall of Fame! This is where all of my wall of fame nominations will be posted.**')

                                for (let message of global_wall) {
                                    this.addToWall(server, message)
                                }
                        }).catch(log.error)
                    }).catch(log.error)
                })
    }

    sendGreeting(server) {
        const channel = this.findSuitableReportingChannel(server)
        channel.send(`Hello! Thanks for inviting me to your server. I shall do my setup and we'll be ready to go! My prefix is ${config[server.id].prefix}`)
    }

    saveGlobalWall() {
        fs.writeFileSync('./global.json', JSON.stringify(global_wall))
    }

    saveConfigFile() {
        fs.writeFileSync('./config.json', JSON.stringify(config))
    }

    serverRemoved(guild) {
        delete config[guild.id]
        this.saveConfigFile()
    }

    checkAndCreateChannel(server) {
        return new Promise((resolve, error) => {
            const wallOfFame = this.getWallOfFame(server)


            if (!wallOfFame) {
                server.createChannel('wall_of_fame')
                        .then(channel => {
                            channel.send('**This is the Wall of Fame! This is where all of my wall of fame nominations will be posted.**')
                            return resolve(channel)
                        })
                        .catch(err => {
                            this.reportError(server, 'create wall_of_fame channel', err)
                            log.error(err)
                            return error()
                        })
            }

            return resolve(wallOfFame)
        })
    }

    getWallOfFame(server) {
        for (let channel of server.channels.values()) {
            if (channel.name === 'wall_of_fame') {
                return channel
            }
        }

        return null
    }

    updatePrefix(server, newPrefix) {
        config[server.id].prefix = newPrefix
        this.saveConfigFile()
    }

    findSuitableReportingChannel(server) {
        const suitableChannels = ['bot_channel', 'bot_chat', 'bot', 'general']

        let backupChannel

        for (let suitable in suitableChannels) {
            for (let channel of server.channels.values()) {
                if (suitable === channel.name) {
                    return channel
                }

                if (channel.name.includes('bot')) {
                    backupChannel = channel
                }
            }

            return (backupChannel ? backupChannel : server.channels[0])
        }
    }

    showHelp(channel) {
        const helpMessage = '```Commands: \n\thelp - Displays this message\n\tprefix <prefix> - changes the prefix to whatever specified\n\tthreshold <threshold> - Updates the servers react threshold (the number of reacts to a message before its added to the wall)```'
        channel.send(helpMessage)
    }

    reportError(server, about, error) {
        const channel = this.findSuitableReportingChannel(server)
        channel.send(`${CODE_MARKUP} There was an error trying to ${about}\n${error.response.message} ${CODE_MARKUP}`)
    }
}

module.exports = WOFBotDJS
