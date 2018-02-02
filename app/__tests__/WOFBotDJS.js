const WOFBotDJS = require('../WOFBotDJS')
const Discord = require('discord.js')

const wofBot = new WOFBotDJS()

test('getWallOfFame works', () => {
    const mockServer = {
        channels: new Discord.Collection()
    }

    const expected = {name: 'wall_of_fame'}

    mockServer.channels.set(52522, {name: 'also-no'})
    mockServer.channels.set(52512, {name: 'not_correct'})
    mockServer.channels.set(25515, expected)

    expect(wofBot.getWallOfFame(mockServer)).toBe(expected)
})

test('checkAndCreateChannel works with channel already existing', () => {
    const mockServer = {
        channels: new Discord.Collection()
    }

    const expected = {name: 'wall_of_fame'}

    mockServer.channels.set(52512, {name: 'not_correct'})
    mockServer.channels.set(25515, expected)

    expect(wofBot.checkAndCreateChannel(mockServer)).resolves.toBe(expected)
})

test('checkAndCreateChannel works with channel not existing', done => {
    const mockSend = jest.fn()
    
    const mockServer = {
        channels: new Discord.Collection(),
        createChannel: jest.fn((name) => new Promise(resolve => resolve({
                    name: name,
                    send: mockSend
                })))
    }

    mockServer.channels.set(52512, {name: 'not_correct'})

    return wofBot.checkAndCreateChannel(mockServer)
            .then(async () => {
                await expect(mockServer.createChannel).toHaveBeenCalledWith('wall_of_fame')
                expect(mockSend).toHaveBeenCalled()
                done()
            })
            .catch(reason => done.fail(`Method rejected promise: ${reason}`))
})

test('findSuitableReportingChannel works as expected', () => {
    const expectedChannel = {name: 'bot_channel'}
    
    const mockServer = {
        channels: new Discord.Collection(),
        
    }
    
    mockServer.channels.set(25252, {name: 'general'})
    mockServer.channels.set(25222, {name: 'bot_fun'})
    mockServer.channels.set(52252, {name: 'test'})
    mockServer.channels.set(2222, expectedChannel)
    
    expect(wofBot.findSuitableReportingChannel(mockServer)).toBe(expectedChannel)
})