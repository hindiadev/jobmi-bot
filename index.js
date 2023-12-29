const dotenv = require('dotenv')
const ExcelJS = require('exceljs')
const fs = require('fs')
const dayjs = require('dayjs')
dotenv.config()

const SIPDBelanjaClient = require('./client')

const client = new SIPDBelanjaClient(
	{
		username: process.env.SIPDAKLAP_USERNAME,
		password: process.env.SIPDAKLAP_PASSWORD,
	},
	{
		headless: process.env.HEADLESS === 'true',
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

	let indicatorTerinput = 0
	let log = ''
	let txtFile = dayjs().format('YYYYMMDDHHmmss')

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		const status = row.getCell('F').value

		if (status) {
			continue
		}

		const tanggal = row.getCell('A').value
		const kodeTransaksi = row.getCell('B').value
		const nominal = row.getCell('C').value
		const file = row.getCell('D').value
		const uraian = row.getCell('E').value

		let kodeTransaksiInput = kodeTransaksi
		let kodeRekeningInput

		if (kodeTransaksi.startsWith('5.1.01')) {
			kodeTransaksiInput = `5.1.01.99.99.9999`
			kodeRekeningInput = `8.1.01.99.99.9999`
		}

		if (kodeTransaksi.startsWith('5.1.02')) {
			kodeTransaksiInput = `5.1.02.99.99.9999`
			kodeRekeningInput = `8.1.02.99.99.9999`
		}

		if (kodeTransaksi.startsWith('5.2')) {
			kodeTransaksiInput = `5.2.02.99.99.9999`
			kodeRekeningInput = `1.3.${kodeTransaksi.substring(4)}`
		}

		try {
			const result = await client.postTNABlud({
				tanggal,
				kodeTransaksi: kodeTransaksiInput,
				kodeRekening: kodeRekeningInput,
				nominal,
				file,
				uraian,
			})

			if (result) {
				row.getCell('F').value = 'Sukses'
				row.getCell('G').value = dayjs().format('YYYY-MM-DD HH:mm:ss')
			} else {
				row.getCell('F').value = 'Gagal'
			}

			await workbook.xlsx.writeFile('INPUT SIPD BOT.xlsx')

			console.log(`✅ ${result.file} - ${result.nominal}`)
			indicatorTerinput++
			log += `${result.file} - ${result.nominal}\n`
		} catch (error) {
			console.error(`❌ Error processing row ${i + 2}: ${error.message}`)
			log += `Error processing row ${i + 2}: ${error.message}\n`
		}

		fs.writeFile(
			`${txtFile}.txt`,
			`Total terinput: ${indicatorTerinput} dari ${rows.length} data yang ada di Excel\n\n${log}`,
			(err) => err && console.error(err)
		)
	}

	console.log('Selesai...')
})

client.on('unauthenticated', async () => {
	console.log('unauthenticated')
	client.login()
})
