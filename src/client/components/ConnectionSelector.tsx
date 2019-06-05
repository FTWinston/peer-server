import React, { useState } from 'react';
import { Connection } from '../../framework/Connection';
import { LocalConnection } from '../../framework/LocalConnection';
import { RemoteConnection } from '../../framework/RemoteConnection';
import { ClientToServerCommand } from '../../shared/ClientToServerCommand';
import { ServerToClientCommand } from '../../shared/ServerToClientCommand';
import { ClientEntity } from '../../shared/ClientState';
import { FullState } from '../../framework/State';

export type TypedConnection = Connection<ClientToServerCommand, ServerToClientCommand, ClientEntity>;

interface IProps {
    receiveCommand: (cmd: ServerToClientCommand) => void;
    receiveState: (state: FullState<ClientEntity>) => void;
    getExistingState: () => FullState<ClientEntity>;
    connectionSelected: (conn: TypedConnection) => void;
}

export const ConnectionSelector = (props: IProps) => {
    let connection: TypedConnection;
    const ready = () => props.connectionSelected(connection);

    const selectLocal = () => {
        connection = new LocalConnection<ClientToServerCommand, ServerToClientCommand, ClientEntity>(
            cmd => props.receiveCommand(cmd),
            state => props.receiveState(state),
            () => props.getExistingState(),
            ready
        );
    }

    
    const [serverId, setServerId] = useState('');

    const selectRemote = () => {
        connection = new RemoteConnection<ClientToServerCommand, ServerToClientCommand, ClientEntity>(
            serverId,
            cmd => props.receiveCommand(cmd),
            state => props.receiveState(state),
            () => props.getExistingState(),
            ready
        );
    }

    return (
    <div>
        <div>
            <button onClick={selectLocal}>Host a local server</button>
        </div>

        <div style={{marginTop: '2em'}}>
            <input
                type="text"
                placeholder="enter server ID"
                value={serverId}
                onChange={e => setServerId(e.target.value)}
            />
            <button 
                onClick={selectRemote}
                disabled={serverId.length === 0}
            >
                Join a remote server
            </button>
        </div>
    </div>
    );
}