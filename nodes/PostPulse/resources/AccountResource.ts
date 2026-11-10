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
	} else if (operation === 'getContactLists') {
		return await getWhatsAppList.call(this, itemIndex, 'contact-lists');
	} else if (operation === 'getTemplates') {
		return await getWhatsAppList.call(this, itemIndex, 'templates');
	}

	throw new NodeOperationError(this.getNode(), `Unknown account operation: ${operation}`, { itemIndex });
}

/**
 * The contact lists or the message templates of a WhatsApp account, as the API returns them. Templates include the
 * unsupported ones: `supported` and `unsupportedReason` tell them apart.
 */
async function getWhatsAppList(
	this: IExecuteFunctions,
	itemIndex: number,
	list: 'contact-lists' | 'templates',
): Promise<any> {
	const accountId = this.getNodeParameter('whatsappAccount', itemIndex) as number | string;

	return await makeApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/whatsapp/${list}`);
}

async function getConnectedChats(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const accountId = this.getNodeParameter('accountId', itemIndex) as number;

	return await makeApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/chats`);
}
