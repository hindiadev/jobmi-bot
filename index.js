const dotenv = require('dotenv')
const ExcelJS = require('exceljs')
dotenv.config()

const SIPDAklapClient = require('./client')

const client = new SIPDAklapClient(
	{
		username: process.env.SIPDAKLAP_USERNAME,
		password: process.env.SIPDAKLAP_PASSWORD,
	},
	{
		timeout: Number(process.env.WAIT_TIMEOUT),
	}
)

client.initialize()

client.on('ready', async () => {
	console.log('ready')
})

client.on('authenticated', async () => {
	console.log('authenticated')

	const workbook = new ExcelJS.Workbook()
	await workbook.xlsx.readFile('INPUT SIPD BOT.xlsx')
	const worksheet = workbook.getWorksheet('Sheet1')

	const rows = worksheet.getRows(2, worksheet.rowCount - 1)

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		const tanggal = row.getCell('A').value
		const kodeTransaksi = row.getCell('B').value
		const nominal = row.getCell('C').value
		const file = row.getCell('D').value
		const uraian = row.getCell('E').value
		const status = row.getCell('F').value

		if (status) {
			continue
		}

		let kodeRekening
		if (kodeTransaksi.startsWith('5.1')) {
			kodeRekening = `8.1.${kodeTransaksi.substring(4)}`
		} else if (kodeTransaksi.startsWith('5.2')) {
			kodeRekening = `1.3.${kodeTransaksi.substring(4)}`
		}

		const data = {
			tanggal,
			kodeTransaksi,
			kodeRekening,
			nominal,
			file,
			uraian,
		}

		;(async () => {
			const result = await client.postTNABlud(data)

			if (result) {
				row.getCell('F').value = 'Sukses'
			} else {
				row.getCell('F').value = 'Gagal'
			}

			await workbook.xlsx.writeFile('INPUT SIPD BOT.xlsx')

			console.log(`✅ ${result.file} - ${result.nominal}`)
		})()
	}
})

client.on('unauthenticated', async () => {
	console.log('unauthenticated')
})
