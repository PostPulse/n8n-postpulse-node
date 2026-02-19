import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export async function makeApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<any> {
	const creds = await this.getCredentials('postPulseOAuth2Api') as { baseUrl?: string; clientId?: string; };
	const baseUrl = (creds.baseUrl || 'https://api.post-pulse.com').replace(/\/+$/, '');
	const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

	const options: IHttpRequestOptions = { 
		method, 
		url, 
		json: true,
		headers: {
			'x-api-key': creds.clientId ?? ''
		},
		returnFullResponse: true,
		ignoreHttpStatusErrors: true
	};
	if (body) options.body = body;
	if (qs) options.qs = qs;

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'postPulseOAuth2Api', options);
	if (response.statusCode >= 400) {
		const apiError = response.body?.error ?? JSON.stringify(response.body);

		throw new NodeOperationError(
			this.getNode(),
			`PostPulse API error (${response.statusCode}): ${apiError}`,
			{ itemIndex: 0 }
		);
	}
	return response.body;
}

export async function makeApiRequestWithFormData(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	formData: IDataObject,
	itemIndex: number,
): Promise<any> {
	const creds = await this.getCredentials('postPulseOAuth2Api') as { baseUrl?: string; clientId?: string; };
	const baseUrl = (creds.baseUrl || 'https://api.post-pulse.com').replace(/\/+$/, '');
	const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

	// For form data, use body with Content-Type header
	const options: IHttpRequestOptions = { 
		method, 
		url, 
		body: formData,
		headers: {
			'x-api-key': creds.clientId ?? '',
			'Content-Type': 'application/x-www-form-urlencoded'
		} 
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(this, 'postPulseOAuth2Api', options);
		// Parse JSON response if needed
		return typeof response === 'string' ? JSON.parse(response) : response;
	} catch (error: any) {
		throw new NodeOperationError(this.getNode(), `Media upload failed: ${error.message}`, { itemIndex });
	}
}
