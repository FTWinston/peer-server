import { SignalConnection, IConnectionSettings } from './SignalConnection';

export class ClientSignalConnection extends SignalConnection {
    private readonly peer: RTCPeerConnection;

    constructor(
        settings: IConnectionSettings,
        private readonly sessionId: string,
        private readonly clientName: string,
        join: (peer: RTCPeerConnection) => void,
        disconnected: () => void,
    ) {
        super(disconnected, settings);

        this.peer = this.createPeer();

        // we need a data channel, otherwise it doesn't gather ICE.
        // TODO: instead of a dummy, have the client establish the reliable connection.
        if (process.env.NODE_ENV === 'development') {
            console.log('creating dummy data channel');
        }
        const controlChannel = this.peer.createDataChannel('control');
        controlChannel.onopen = () => console.log('control channel opened');
        controlChannel.onclose =  () => console.log('control channel closed');
        // TODO: adapt this to have the client establish the reliable connection.

        this.peer.onconnectionstatechange = () => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`peer state changed: ${this.peer.connectionState}`);
            }

            if (this.peer.connectionState === 'connected') {
                join(this.peer);
                this.disconnect();
            }
        };
    }

    protected async socketOpened() {
        this.gatherIce(this.peer, name);

        const offer = await this.peer.createOffer();

        if (process.env.NODE_ENV === 'development') {
            console.log('set local description');
        }

        await this.peer.setLocalDescription(offer);

        this.send(['join', this.sessionId, this.clientName, this.peer.localDescription.sdp]);
    }

    protected async receivedMessage(event: MessageEvent) {
        const data: string[] = JSON.parse(event.data);
        const message = data[0];

        if (!Array.isArray(data) || data.length < 1) {
            throw new Error(`Unexpected data type received from signal server, expected array but got ${data}`);
        }

        if (message === 'answer') {
            await this.receiveAnswer(data[1]);
        }
        else if (message === 'ice') {
            await this.receiveIce(JSON.parse(data[2]));
        }
        else {
            throw new Error(`Unexpected data received from signal server, expected answer or ice, but got ${message}`);
        }
    }

    private async receiveAnswer(answer: string) {
        if (process.env.NODE_ENV === 'development') {
            console.log('set remote description');
        }
        
        await this.peer.setRemoteDescription({
            sdp: answer,
            type: 'answer'
        });
    }

    private async receiveIce(candidate: RTCIceCandidateInit) {
        if (process.env.NODE_ENV === 'development') {
            console.log('receive ice');
        }
        
        await this.peer.addIceCandidate(candidate);
    }
}