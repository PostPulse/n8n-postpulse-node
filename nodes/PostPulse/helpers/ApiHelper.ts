import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';

import { NodeApiError } from 'n8n-workflow';

export async function makeApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<any> {
	const creds = await this.getCredentials('postPulseOAuth2Api') as { baseUrl?: string };
	const baseUrl = (creds.baseUrl || 'https://api.post-pulse.com').replace(/\/+$/, '');
	const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

	const options: IHttpRequestOptions = {
		method,
		url,
		json: true,
		returnFullResponse: true,
	};
	if (body) options.body = body;
	if (qs) options.qs = qs;

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'postPulseOAuth2Api',
			options,
		);

		if (response.statusCode >= 400) {
			throw new NodeApiError(this.getNode(), response as unknown as JsonObject);
		}

		return response.body;
	} catch (error) {
		if (error instanceof NodeApiError) {
			throw error;
		}
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function makeApiRequestWithFormData(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	formData: IDataObject,
): Promise<any> {
	const creds = await this.getCredentials('postPulseOAuth2Api') as { baseUrl?: string };
	const baseUrl = (creds.baseUrl || 'https://api.post-pulse.com').replace(/\/+$/, '');
	const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

	const options: IHttpRequestOptions = {
		method,
		url,
		body: formData,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'postPulseOAuth2Api',
			options,
		);
		return typeof response === 'string' ? JSON.parse(response) : response;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
