exports.numberFormat = function (num) {
	let parts = num.toString().split('.')

	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
	if (parts[1]) {
		parts[1] = ',' + parts[1]
	}

	return parts.join('')
}
