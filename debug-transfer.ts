import { getTransferByToken } from './utils/actions/transfer'

async function debug() {
    const token = process.argv[2]
    if (!token) {
        console.log('Usage: npx ts-node debug-transfer.ts <token>')
        return
    }

    console.log('Checking token:', token)
    const res = await getTransferByToken(token)
    console.log('Result:', JSON.stringify(res, null, 2))
}

debug()
