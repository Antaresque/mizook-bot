import { DissonanceClient } from "@antaresque/dissonance";
import 'dotenv/config';

const client = new DissonanceClient({
    applicationId: process.env.ID!
});

client.login(process.env.TOKEN!);