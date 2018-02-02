const express = require('express')

var app = express();
app.set('view engine', 'pug')

app.all('/', (req, res) => {
    res.redirect('/wall-of-fame')
})

app.get('/wall-of-fame', (req, res) => {
    var servers = global.botClient.guilds.array().length
    res.render('index', {servers: servers})
})

app.get('/wall-of-fame/list', (req, res) => {
    var servers = global.botClient.guilds.array()
    res.render('server-list', {servers: servers})
})

app.listen(2243, () => {
    console.log("Web Service Started on 2243")
})