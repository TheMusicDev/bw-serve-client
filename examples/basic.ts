// Run: bw serve   (in another terminal, vault unlocked)  then:  bun examples/basic.ts
import { BwApiError, BwConnectionError, BwServeClient } from '../src/index';

const bw = new BwServeClient();

try {
    const { status } = await bw.status();
    if (status !== 'unlocked') {
        console.log(`Vault is ${status}. Call bw.unlock(masterPassword) first.`);
        process.exit(1);
    }

    const logins = await bw.listItems({ search: 'github' });
    for (const item of logins) console.log(item.name, item.login?.username);

    console.log('generated:', await bw.generate({ length: 24, special: 2 }));
} catch (error) {
    if (error instanceof BwConnectionError) console.error(error.message);
    else if (error instanceof BwApiError) console.error(`bw said: ${error.message}`);
    else throw error;
}
