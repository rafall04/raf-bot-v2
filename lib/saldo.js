const fs = require('fs')
// const uang = JSON.parse(fs.readFileSync('./database/user/atm.json'))


const addATM = (sender) => {
	const obj = {id: sender, uang : 0, saldo : 0}
    atm.push(obj)
    fs.writeFileSync('./database/user/atm.json', JSON.stringify(atm))
}

const addKoinUser = (userId, amount) => {
    let position = false
    Object.keys(atm).forEach((i) => {
        if (atm[i].id === userId) {
            position = i
        }
    })
    if (position !== false) {
        atm[position].saldo += parseInt(amount)
        fs.writeFileSync('./database/user/atm.json', JSON.stringify(atm, null, 2))
    }
}

const checkATMuser = (userId) => {
    let position = false
    Object.keys(atm).forEach((i) => {
        if (atm[i].id === userId) {
            position = i
        }
    })
    if (position !== false) {
        return atm[position].saldo
    }
}
    
const confirmATM = (userId, amount) => {
    let position = false
    Object.keys(atm).forEach((i) => {
        if (atm[i].id === userId) {
            position = i
        }
    })
    if (position !== false) {
        atm[position].saldo -= parseInt(amount)
        fs.writeFileSync('./database/user/atm.json', JSON.stringify(atm, null, 2))
    }
}

const checkRegisteredATM = (userId) => {
    let status = false
    Object.keys(atm).forEach((i) => {
        if (atm[i].id === userId) {
            status = true
        }
    })
    return status
}

const delSaldo = (nomer) => {
    let position = null
    Object.keys(atm).forEach((i) => {
        if (atm[i].id === nomer) {
            position = i
        }
    })
    if (position !== null) {
        atm.splice(position, 1)
        fs.writeFileSync('./database/user/atm.json', JSON.stringify(atm))
    }
    return true
}

module.exports = {
	addATM,
    addKoinUser,
	checkATMuser,
	confirmATM,
	checkRegisteredATM,
    delSaldo,
}