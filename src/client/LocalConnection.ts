import { Connection, peerOptions } from './Connection';
import Peer from 'peerjs';
import ServerWorker from '../server/worker';

export class LocalConnection extends Connection {
    private worker: Worker;
    private peer: Peer;

    constructor(receiveMessage: (data: any) => void, ready: () => void) {
        super();
        
        this.worker = new ServerWorker();

        this.worker.onmessage = e => receiveMessage(e.data);

        this.peer = new Peer(peerOptions);

        console.log('peer created', this.peer);

        this.peer.on('error', err => {
            console.log('local connection peer error', err);
        });

        this.peer.on('disconnected', () => {
            console.log('local connection peer has been disconnected');
        });

        this.peer.on('open', id => {
            console.log(`local server's peer ID is ${id}`);

            ready();
        });

        this.peer.on('connection', conn => {
            console.log(`Peer connected: ${conn.peer}`);

            conn.on('data', data => {
                console.log(`data received from client ${conn.peer}:`, data);
            });
        });
    }

    sendMessage(msg: any) {
        this.worker.postMessage(msg);
    }

    disconnect() {
        this.worker.terminate();
        this.peer.destroy();
    }

    getServerId() { 
        return this.peer.id;
    }
}