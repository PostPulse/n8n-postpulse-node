import type {
	IExecuteFunctions,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { makeApiRequest } from '../helpers/ApiHelper';

export async function executeAccountOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	if (operation === 'getAll') {
		return await makeApiRequest.call(this, 'GET', '/v1/accounts');
	} else if (operation === 'getConnectedChats') {
		return await getConnectedChats.call(this, itemIndex);
	}
	
	throw new NodeOperationError(this.getNode(), `Unknown account operation: ${operation}`, { itemIndex });
}

async function getConnectedChats(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const accountId = this.getNodeParameter('accountId', itemIndex) as number;
	const platform = this.getNodeParameter('platform', itemIndex) as string;

	const endpoint = `/v1/accounts/${accountId}/chats`;
	const queryParams = { platform };

	return await makeApiRequest.call(this, 'GET', endpoint, undefined, queryParams);
}
