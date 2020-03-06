import { peerOptions } from './Connection';
import Peer from 'peerjs';
import { ServerWorkerMessageInType } from './ServerWorkerMessageIn';
import { commandMessageIdentifier, deltaStateMessageIdentifier, fullStateMessageIdentifier } from './ServerToClientMessage';
import { Delta } from './Delta';
import { ClientToServerMessage } from './ClientToServerMessage';
import { OfflineConnection } from './OfflineConnection';

export class LocalConnection<TClientToServerCommand, TServerToClientCommand, TClientState>
    extends OfflineConnection<TClientToServerCommand, TServerToClientCommand, TClientState> {
    private peer: Peer;
    private readonly clientConnections = new Map<string, Peer.DataConnection>();

    constructor(
        worker: Worker,
        receiveCommand: (cmd: TServerToClientCommand) => void,
        receiveState: (state: TClientState) => void,
        getExistingState: () => TClientState,
        ready: () => void
    ) {
        super(worker, receiveCommand, receiveState, getExistingState, () => {});
        
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

            // TODO: if this peer identifier is already in use ... ?
            this.clientConnections.set(conn.peer, conn);

            this.sendMessageToServer({
                type: ServerWorkerMessageInType.Join,
                who: conn.peer,
            });

            conn.on('close', () => {
                this.clientConnections.delete(conn.peer);

                this.sendMessageToServer({
                    type: ServerWorkerMessageInType.Quit,
                    who: conn.peer,
                }); 
            })

            conn.on('data', (data: ClientToServerMessage<TClientToServerCommand>) => {
                console.log(`data received from client ${conn.peer}:`, data);
                const type = data[0];
                const payload = data[1];

                if (type === 'a') {
                    this.sendMessageToServer({
                        type: ServerWorkerMessageInType.Acknowledge,
                        who: this.peer.id,
                        time: payload as number,
                    });
                }
                else {
                    this.sendMessageToServer({
                        type: ServerWorkerMessageInType.Command,
                        who: conn.peer,
                        command: payload as TClientToServerCommand,
                    });
                }
            });
        });
    }

    protected dispatchCommandFromServer(client: string | undefined, command: TServerToClientCommand) {
        // commands might specify no client, and so should go to everyone
        if (client === undefined) {
            super.dispatchCommandFromServer(client, command);

            for (const conn of this.clientConnections.values()) {
                conn.send([commandMessageIdentifier, command]);
            }
        }
        else if (client === this.peer.id) {
            super.dispatchCommandFromServer(client, command);
        }
        else {
            const conn = this.clientConnections.get(client);
            conn.send([commandMessageIdentifier, command]);
        }
    }

    protected dispatchFullStateFromServer(client: string, state: TClientState, time: number) {
        if (client === this.peer.id) {
            super.dispatchFullStateFromServer(client, state, time);
        }
        else {
            const conn = this.clientConnections.get(client);
            conn.send([fullStateMessageIdentifier, state, time]);
        }
    }

    protected dispatchDeltaStateFromServer(client: string, state: Delta<TClientState>, time: number) {
        if (client === this.peer.id) {
            super.dispatchDeltaStateFromServer(client, state, time);
        }
        else {
            const conn = this.clientConnections.get(client);
            conn.send([deltaStateMessageIdentifier, state, time]);
        }
    }

    disconnect() {
        super.disconnect();
        this.peer.destroy();
    }

    get localId() {
        return this.peer.id;
    }
}