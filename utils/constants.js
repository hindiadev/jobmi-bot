/**
 * Events that can be emitted by the client
 * @description Constants used in the application
 * @readonly
 * @enum {string}
 */
exports.EventsConstants = {
	READY: 'ready',
	AUTHENTICATED: 'authenticated',
	UNAUTHENTICATED: 'unauthenticated',
	LOGIN_SUCCESS: 'login_success',
	LOGIN_FAILED: 'login_failed',
	DESTROYED: 'destroyed',
}
