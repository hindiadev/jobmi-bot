const dotenv = require('dotenv')
dotenv.config()

const SIPDAklapClient = require('./client')

const client = new SIPDAklapClient({
	username: process.env.SIPDAKLAP_USERNAME,
	password: process.env.SIPDAKLAP_PASSWORD,
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
})

const express = require('express')
const app = express()
const port = 3000

app.get('/', async (req, res) => {
	const journal = {
		tanggal: '2023-12-31',
		kodeTransaksi: '5.1.01.99.99.9999',
		kodeRekening: '8.1.01.99.99.9999',
		nominal: 999999999,
		file: 'test.pdf',
		uraian: 'Belanja Pegawai Testing',
	}

	const response = await client.postTNABlud(journal)

	return res.json(response)
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})
