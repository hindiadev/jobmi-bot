const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const dayjs = require('dayjs')
dayjs.locale(require('dayjs/locale/id'))
const EventEmitter = require('events')
const { EventsConstants } = require('./utils/constants')
const { numberFormat } = require('./utils/number')

class SIPDAklapClient extends EventEmitter {
	constructor({ username, password }, { timeout, slowMo }) {
		super()
		this.username = username
		this.password = password

		this.timeout = timeout || undefined
		this.slowMo = slowMo || undefined

		this.siteUrl = (url) => {
			return 'https://sipd.kemendagri.go.id/aklap' + url
		}
		this.folder_auth_session = path.resolve(
			__dirname,
			'.auth_session',
			'SIPDAklapClient',
			this.username
		)

		this.browser = null
		this.context = null
		this.page = null
	}

	/**
	 * Initialize SIPD AKLAP Client
	 * @returns {Promise<void>}
	 * @example
	 * const client = new SIPDAklapClient({
	 *  	username: "ppkATMA",
	 * 	password: "****"
	 * })
	 * client.initialize()
	 * client.on('ready', () => { ... })
	 */
	async initialize() {
		const browser = await chromium.launch({
			headless: false,
			slowMo: this.slowMo,
		})
		const context = await browser.newContext()
		const page = await context.newPage()

		this.browser = browser
		this.context = context
		this.page = page

		await page.goto(this.siteUrl('/'), {
			timeout: this.timeout,
		})

		await page.waitForURL(this.siteUrl('/'), {
			timeout: this.timeout,
		})

		const readiness = page.url() === this.siteUrl('/')

		if (!readiness)
			throw new Error('SIPD AKLAP is not ready, please try again later.')

		this.emit(EventsConstants.READY)

		if (!(await this.loginStatus())) {
			this.emit(EventsConstants.UNAUTHENTICATED)
			return
		}

		this.emit(EventsConstants.AUTHENTICATED)
	}

	/**
	 * Destroy SIPD AKLAP Client
	 * @returns {Promise<void>}
	 * @example
	 * const client = new SIPDAklapClient()
	 * client.destroy()
	 * client.on('destroyed', () => { ... })
	 */
	async destroy() {
		await this.browser.close()

		this.emit(EventsConstants.DESTROYED)
	}

	/**
	 * Check login status
	 * @returns {Promise<boolean>}
	 * @example
	 * const client = new SIPDAklapClient()
	 * client.loginStatus()
	 */
	async loginStatus() {
		const context = this.context
		const page = this.page

		const cookiesPath = path.join(this.folder_auth_session, 'cookies.json')

		if (!fs.existsSync(cookiesPath)) {
			return false
		}

		const cookies = fs.readFileSync(cookiesPath, 'utf8')

		const deserializedCookies = JSON.parse(cookies)
		await context.addCookies(deserializedCookies)

		await page.goto(this.siteUrl('/home'), {
			timeout: this.timeout,
		})

		if (page.url() !== this.siteUrl('/home')) {
			return false
		}

		return true
	}

	/**
	 * Login to SIPD AKLAP
	 * @returns {Promise<void>}
	 * @example
	 * client.login({ username: "ppkATMA", password: "**********" });
	 * client.on('authenticated', () => { ... })
	 */
	async login() {
		const context = this.context
		const page = this.page

		if (await this.loginStatus()) {
			this.emit(EventsConstants.AUTHENTICATED)
			return
		}

		await page.goto(this.siteUrl('/login'), {
			waitUntil: 'domcontentloaded',
			timeout: this.timeout,
		})

		await page.isVisible('btn[type="submit"]')

		await page.fill('input[name="username"]', this.username)
		await page.fill('input[name="password"]', this.password)

		await page.locator('.v-select').nth(0).click()
		await page.keyboard.type(dayjs().format('YYYY'))
		await page.getByText(dayjs().format('YYYY'))
		await page.keyboard.press('Enter')

		await page.waitForResponse(
			(resp) => resp.url().includes('daerah-by-tahun') && resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page.locator('.v-select').nth(1).click()
		await page.keyboard.type('Provinsi Kalimantan Timur')
		await page.getByText('Provinsi Kalimantan Timur')
		await page.keyboard.press('Enter')

		await page.click('label[for="remember"]')

		await page.getByText('Log In').click()

		await page.waitForURL(this.siteUrl('/home'), {
			timeout: this.timeout,
		})

		const loggedIn = page.url() === this.siteUrl('/home')
		if (!loggedIn) {
			this.emit(EventsConstants.LOGIN_FAILED)
			return
		}

		const cookies = await context.cookies()
		const cookieJson = JSON.stringify(cookies)

		if (!fs.existsSync(this.folder_auth_session)) {
			fs.mkdirSync(this.folder_auth_session, {
				recursive: true,
			})
		}

		fs.writeFileSync(path.join(this.folder_auth_session, 'cookies.json'), cookieJson)

		this.emit(EventsConstants.LOGIN_SUCCESS)
		this.emit(EventsConstants.AUTHENTICATED)
	}

	/**
	 * Post Jurnal TNA BLUD
	 * @param {Array} journals
	 * @returns {Object}
	 * @example
	 * const journals = {
	 * 	"tanggal": "2023-12-31",
	 * 	"kodeTransaksi": "5.1.01.99.99.9999",
	 * 	"kodeRekening": "8.1.01.99.99.9999",
	 * 	"nominal": "999999999",
	 * 	"file": "test.pdf",
	 * 	"uraian": "Belanja Pegawai Testing"
	 * }
	 * client.postTNABlud(journal)
	 */
	async postTNABlud({
		tanggal,
		kodeTransaksi,
		kodeRekening,
		nominal,
		file,
		uraian,
	}) {
		const page = this.page

		await page.goto(this.siteUrl('/input-transaksi-non-anggaran'), {
			waitUntil: 'domcontentloaded',
			referer: this.siteUrl('/home'),
			timeout: this.timeout,
		})
		await page.waitForURL(this.siteUrl('/input-transaksi-non-anggaran'), {
			timeout: this.timeout,
		})

		await page.selectOption('select.custom-select', 'badan-layanan-umum-daerah')
		await page.isVisible('button.btn-success')

		await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('get-skpd') && resp.status() === 200,
				{
					timeout: this.timeout,
				}
			),
			page.waitForResponse(
				(resp) => resp.url().includes('skpd-unit') && resp.status() === 200,
				{
					timeout: this.timeout,
				}
			),
			page.waitForResponse(
				(resp) =>
					resp.url().includes('generate-nomor') && resp.status() === 200,
				{
					timeout: this.timeout,
				}
			),
		])

		await page.click('[aria-describedby="input-tanggal_jurnal-feedback"]')
		await page.isVisible('header.b-calendar-grid-caption')

		const bulanInComponent = await page.$eval(
			'header.b-calendar-grid-caption',
			(el) => el.innerHTML
		)
		const converterBulanComponent = (inComponent) => {
			const bulanIndonesia = [
				'Januari',
				'Februari',
				'Maret',
				'April',
				'Mei',
				'Juni',
				'Juli',
				'Agustus',
				'September',
				'Oktober',
				'November',
				'Desember',
			]
			const namaBulan = inComponent.split(' ')[0]
			const bulan = bulanIndonesia.indexOf(namaBulan) + 1
			const tahun = inComponent.split(' ')[1]
			return dayjs(`${tahun}-${bulan}-01`)
		}

		const bulanValueComponent = converterBulanComponent(bulanInComponent)
		const tanggalInput = dayjs(tanggal)

		const diffMonth = tanggalInput.diff(bulanValueComponent, 'month')

		if (diffMonth > 0) {
			for (let i = 0; i < diffMonth; i++) {
				await page.click('button[title="Next month"]')
			}
		} else {
			for (let i = 0; i <= Math.abs(diffMonth); i++) {
				await page.click('button[title="Previous month"]')
			}
		}

		const tanggalString = tanggalInput.format('YYYY-MM-DD')
		await page.click(`[data-date="${tanggalString}"]`)

		await page.getByText('Pilih Urusan*').click()
		await page
			.getByText(
				'URUSAN PEMERINTAHAN WAJIB YANG BERKAITAN DENGAN PELAYANAN DASAR'
			)
			.click()

		await page.waitForResponse(
			(resp) => resp.url().includes('get-urusan') && resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page.getByText('Pilih Bidang Urusan*').click()
		await page.getByText('URUSAN PEMERINTAHAN BIDANG KESEHATAN').click()

		await page.waitForResponse(
			(resp) => resp.url().includes('get-urusan') && resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page.getByText('Pilih Program*').click()
		await page
			.getByText('PROGRAM PENUNJANG URUSAN PEMERINTAHAN DAERAH PROVINSI')
			.click()

		await page.waitForResponse(
			(resp) => resp.url().includes('get-urusan') && resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page.getByText('Pilih Kegiatan*').click()
		await page.getByText('Peningkatan Pelayanan BLUD').click()

		await page.waitForResponse(
			(resp) => resp.url().includes('get-urusan') && resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page.getByText('Pilih Sub Kegiatan*').click()
		await page.getByText('Pelayanan dan Penunjang Pelayanan BLUD').click()

		await page.waitForResponse(
			(resp) =>
				resp.url().includes('main-account-list-urusan?') &&
				resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page
			.getByLabel('Pilih Transaksi')
			.getByText('Pilih Transaksi')
			.click()
		await page.keyboard.type(kodeTransaksi)

		await page.waitForResponse(
			(resp) =>
				resp.url().includes('main-account-list-urusan?') &&
				resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)
		await page.getByText(kodeTransaksi).click()

		await Promise.all([
			page.waitForResponse(
				(resp) =>
					resp.url().includes('get-nominal-anggaran?') && resp.status() === 200,
				{
					timeout: this.timeout,
				}
			),
			page.waitForResponse(
				(resp) =>
					resp.url().includes('main-account-list-rekening?') &&
					resp.status() === 200,
				{
					timeout: this.timeout,
				}
			),
		])

		await page.getByText('Pilih Kode Rekening').click()
		await page.keyboard.type(kodeRekening)

		await page.waitForResponse(
			(resp) =>
				resp.url().includes('main-account-list-rekening?') &&
				resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)
		await page.getByText(kodeRekening).click()

		await page.waitForResponse(
			(resp) =>
				resp.url().includes('paired-account-list?') && resp.status() === 200,
			{
				timeout: this.timeout,
			}
		)

		await page.fill(
			'input[aria-describedby="input-nominal_realisasi-feedback"]',
			String(nominal).toString()
		)

		await page.getByText('Preview').click()
		await page.getByText('Tutup').click()
		await page.getByText('Tambah').click()

		const fileChooserPromise = page.waitForEvent('filechooser', {
			timeout: this.timeout,
		})
		await page.click('.custom-file.b-form-file')
		const fileChooser = await fileChooserPromise
		await fileChooser.setFiles(path.resolve(__dirname, 'files', file))

		await page.fill('input[aria-describedby="input-nilai-feedback"]', uraian)

		await page.getByText('Preview').click()

		const count = await page.getByText(numberFormat(nominal)).count()

		if (count !== 4) {
			return
		}

		await page.getByText('Tutup').click()
		await page.getByText('Simpan').click()

		await page.click('.swal2-confirm')

		await page.waitForURL(this.siteUrl('/home'), {
			waitUntil: 'domcontentloaded',
			timeout: this.timeout,
		})

		return {
			tanggal,
			kodeTransaksi,
			kodeRekening,
			nominal,
			file,
			uraian,
		}
	}
}

module.exports = SIPDAklapClient
