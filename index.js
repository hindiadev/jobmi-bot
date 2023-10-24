const dotenv = require('dotenv')
const ExcelJS = require('exceljs')
const fs = require('fs');
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
	console.log('authenticated');

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile('INPUT SIPD BOT.xlsx');
	const worksheet = workbook.getWorksheet('Sheet1');
	const rows = worksheet.getRows(2, worksheet.rowCount - 1);
	let indicatorTerinput = 0;

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const status = row.getCell('F').value;

		if (status) {
			continue;
		}

		const tanggal = row.getCell('A').value;
		const kodeTransaksi = row.getCell('B').value;
		const nominal = row.getCell('C').value;
		const file = row.getCell('D').value;
		const uraian = row.getCell('E').value;

		let kodeRekening;

		if (kodeTransaksi.startsWith('5.1')) {
			kodeRekening = `8.1.${kodeTransaksi.substring(4)}`;
		} else if (kodeTransaksi.startsWith('5.2')) {
			kodeRekening = `1.3.${kodeTransaksi.substring(4)}`;
		}

		try {
			const result = await client.postTNABlud({
				tanggal,
				kodeTransaksi,
				kodeRekening,
				nominal,
				file,
				uraian,
			});

			if (result) {
				row.getCell('F').value = 'Sukses';
			} else {
				row.getCell('F').value = 'Gagal';
			}

			await workbook.xlsx.writeFile('INPUT SIPD BOT.xlsx');

			console.log(`✅ ${result.file} - ${result.nominal}`);
			indicatorTerinput++;
		} catch (error) {
			console.error(`❌ Error processing row ${i + 2}: ${error.message}`);
		}
	}


	const fileName = `INPUT SIPD BOT.txt`;
	const fileContent = `Total terinput: ${indicatorTerinput} dari ${rows.length} data yang ada di Excel`;

	fs.writeFile(fileName, fileContent, (err) => {
		if (err) {
			console.error(err);
			return;
		}
		console.log('File created!');
	});
});

client.on('unauthenticated', async () => {
	console.log('unauthenticated')
	client.login()
})
