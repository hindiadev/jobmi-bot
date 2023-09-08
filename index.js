const dotenv = require('dotenv')
dotenv.config()

const SIPDAklapClient = require('./client')

const client = new SIPDAklapClient({
	username: process.env.SIPD_USERNAME,
	password: process.env.SIPD_PASSWORD,
})

client.initialize()

client.on('ready', async () => {
	console.log('ready')
})

client.on('authenticated', async () => {
	console.log('authenticated')
})

client.on('unauthenticated', async () => {
	console.log('unauthenticated')
	await client.login()
})

client.on('login_success', async () => {
	console.log('login_success')
})

client.on('login_failed', async () => {
	console.log('login_failed')
})
