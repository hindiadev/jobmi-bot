const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const dayjs = require('dayjs')
dayjs.locale(require('dayjs/locale/id'))
const EventEmitter = require('events')
const { EventsConstants } = require('./utils/constants')

class SIPDAklapClient extends EventEmitter {
	constructor({ username, password }) {
		super()
		this.username = username
		this.password = password

		this.siteUrl = (url) => {
			return 'https://sipd.kemendagri.go.id/aklap' + url
		}
		this.FOLDER_AUTH = path.resolve(
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
	 * const client = new SIPDAklapClient()
	 * client.initialize()
	 * client.on('ready', () => { ... })
	 */
	async initialize() {
		const browser = await chromium.launch({
			headless: false,
		})
		const context = await browser.newContext()
		const page = await context.newPage()

		this.browser = browser
		this.context = context
		this.page = page

		await page.goto(this.siteUrl('/'))

		await page.waitForURL(this.siteUrl('/'))

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

		const cookiesPath = path.join(this.FOLDER_AUTH, 'cookies.json')

		if (!fs.existsSync(cookiesPath)) {
			return false
		}

		const cookies = fs.readFileSync(cookiesPath, 'utf8')

		const deserializedCookies = JSON.parse(cookies)
		await context.addCookies(deserializedCookies)

		await page.goto(this.siteUrl('/home'))

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

		await page.goto(this.siteUrl('/login'))

		await page.isVisible('btn[type="submit"]')

		await page.fill('input[name="username"]', this.username)
		await page.fill('input[name="password"]', this.password)

		await page.click('#vs1__combobox')
		await page.keyboard.type(dayjs().format('YYYY'))
		await page.keyboard.press('Enter')

		await page.waitForResponse(
			(resp) => resp.url().includes('daerah-by-tahun') && resp.status() === 200
		)

		await page.click('#vs2__combobox')
		await page.keyboard.type('Provinsi Kalimantan Timur')
		await page.keyboard.press('Enter')

		await page.click('label[for="remember"]')

		await page.getByText('Log In').click()

		await page.waitForURL(this.siteUrl('/home'))

		const loggedIn = page.url() === this.siteUrl('/home')
		if (!loggedIn) {
			this.emit(EventsConstants.LOGIN_FAILED)
			return
		}

		const cookies = await context.cookies()
		const cookieJson = JSON.stringify(cookies)

		if (!fs.existsSync(this.FOLDER_AUTH)) {
			fs.mkdirSync(this.FOLDER_AUTH, {
				recursive: true,
			})
		}

		fs.writeFileSync(path.join(this.FOLDER_AUTH, 'cookies.json'), cookieJson)

		this.emit(EventsConstants.LOGIN_SUCCESS)
		this.emit(EventsConstants.AUTHENTICATED)
	}
}

module.exports = SIPDAklapClient
