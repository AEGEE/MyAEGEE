<?php
/**
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 * http://www.gnu.org/copyleft/gpl.html
 *
 * @file
 * @ingroup Auth
 */

use \MediaWiki\Auth\AuthenticationRequest;
use \MediaWiki\Auth\ButtonAuthenticationRequest;
use \MediaWiki\Auth\AbstractPrimaryAuthenticationProvider;
use \MediaWiki\Auth\AbstractPasswordPrimaryAuthenticationProvider;
use \MediaWiki\Auth\AuthManager;
use \MediaWiki\Auth\AuthenticationResponse;

/**
 * A primary authentication provider that uses the password field in the 'user' table.
 * @ingroup Auth
 * @since 1.27
 */
class MyAEGEEApiPrimaryAuthenticationProvider
	extends AbstractPasswordPrimaryAuthenticationProvider
{

	/**
	 * @param array $params Settings
	 *    the local password will be invalidated when authentication is changed
	 *    and new users will not have a valid local password set.
	 */
	public function __construct( $params = [] ) {
		parent::__construct( $params );
		$this->baseHost = 'https://my.aegee.eu';
		$this->loginUrl = $this->baseHost.'/services/oms-core-elixir/api/login';
		$this->getUserUrl = $this->baseHost.'/services/oms-core-elixir/api/members/me';
	}

	/**
	 * Check if the password has expired and needs a reset
	 *
	 * @param string $username
	 * @param \stdClass $row A row from the user table
	 * @return \stdClass|null
	 */
	protected function getPasswordResetData( $username, $row ) {
		return null;
	}

	/**
	 * Makes a /login request to core.
	 * @param{string} $username
	 * @param{string} $password
	 * @return $access_token
	 */
	private function tryLogin($username, $password) {
		$ch = curl_init($this->loginUrl);

		$body = json_encode(array(
			'username'=>$username,
			'password'=>$password
		));

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_HTTPHEADER, array(
			'Accept: application/json',
			'Content-Type: application/json'
		));

        $response = curl_exec($ch);
        $error    = curl_error($ch);
		$errno    = curl_errno($ch);

        if (is_resource($ch)) {
            curl_close($ch);
		}

        if (0 !== $errno) {
			wfDebugLog( 'MyAEGEEApi', 'Auth request returned error, failing.' );
            return null;
		}

		$response_parsed = json_decode($response);
		if (!$response_parsed->success) {
			wfDebugLog( 'MyAEGEEApi', 'Auth request not successful, failing.' );
			return null;
		}

		return $response_parsed->access_token;
	}

	/**
	 * Fetches user from core.
	 * @param{string} $access_token
	 * @return $user
	 */
	private function tryGetUser($access_token) {
		$ch = curl_init($this->getUserUrl);

		$body = json_encode(array(
			'username'=>$username,
			'password'=>$password
		));

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HTTPHEADER, array(
			'Accept: application/json',
			'Content-Type: application/json',
			'X-Auth-Token: '.$access_token
		));

        $response = curl_exec($ch);
        $error    = curl_error($ch);
		$errno    = curl_errno($ch);

        if (is_resource($ch)) {
            curl_close($ch);
		}

        if (0 !== $errno) {
			wfDebugLog( 'MyAEGEEApi', 'User request returned error, failing.' );
            return null;
		}

		$response_parsed = json_decode($response);
		if (!$response_parsed->success) {
			wfDebugLog( 'MyAEGEEApi', 'User request not successful, failing.' );
			return null;
		}

		return $response_parsed->data;
	}

	/**
	 * All fun starts here.
	 */
	public function beginPrimaryAuthentication( array $reqs ) {
		if ( !$reqs[0] ) {
			wfDebugLog( 'MyAEGEEApi', 'No req, failing' );
			return AuthenticationResponse::newAbstain();
		}

		$username = $reqs[0]->username;
		$password = $reqs[0]->password;

		if ( $username === null || $password === null ) {
			wfDebugLog( 'MyAEGEEApi', 'Empty password or username, failing' );
			return AuthenticationResponse::newAbstain();
		}

		$username = User::getCanonicalName( $username, 'usable' );
		if ( $username === false ) {
			wfDebugLog( 'MyAEGEEApi', 'Username not usable, failing' );
			return AuthenticationResponse::newAbstain();
		}

		$access_token = $this->tryLogin($username, $password);
		wfDebugLog( 'MyAEGEEApi', 'Got access token');

		if (!$access_token) {
			wfDebugLog( 'MyAEGEEApi', 'Access token failed, failing.');
			return AuthenticationResponse::newAbstain();
		}

		wfDebugLog( 'MyAEGEEApi', 'Auth succeeded.');

		$user = $this->tryGetUser($access_token);
		if (!$user) {
			wfDebugLog( 'MyAEGEEApi', 'User failed, failing.');
			return AuthenticationResponse::newAbstain();
		}

		$username = $user->first_name.' '.$user->last_name;
		wfDebugLog( 'MyAEGEEApi', 'User succeeded: '.$username);

		return AuthenticationResponse::newPass( $username );
	}

	public function testUserCanAuthenticate( $username ) {
		wfDebugLog( 'MyAEGEEApi', 'testUserCanAuthenticate start');
		return true;
	}

	public function testUserExists( $username, $flags = User::READ_NORMAL ) {
		wfDebugLog( 'MyAEGEEApi', 'testUserExists called');
		return false;
	}

	/**
	 * A stub to just implement something.
	 */
	public function providerAllowsAuthenticationDataChange(
		AuthenticationRequest $req, $checkData = true
	) {
		wfDebugLog( 'MyAEGEEApi', 'providerAllowsAuthenticationDataChange called');
		return \StatusValue::newGood( 'ignored' );
	}

	/**
	 * A stub to just implement something.
	 */
	public function providerChangeAuthenticationData( AuthenticationRequest $req ) {
		wfDebugLog( 'MyAEGEEApi', 'providerChangeAuthenticationData start');
	}

	/**
	 * A stub to just implement something.
	 */
	public function accountCreationType() {
		wfDebugLog( 'MyAEGEEApi', 'accountCreationType called start');
		return self::TYPE_NONE;
	}

	/**
	 * A stub to just implement something.
	 */
	public function testForAccountCreation( $user, $creator, array $reqs ) {
		wfDebugLog( 'MyAEGEEApi', 'testForAccountCreation called');
	}

	/**
	 * A stub to just implement something.
	 */
	public function beginPrimaryAccountCreation( $user, $creator, array $reqs ) {
		wfDebugLog( 'MyAEGEEApi', 'beginPrimaryAccountCreation called');
		return AuthenticationResponse::newAbstain();
	}

	/**
	 * A stub to just implement something.
	 */
	public function finishAccountCreation( $user, $creator, AuthenticationResponse $res ) {
		wfDebugLog( 'MyAEGEEApi', 'finishAccountCreation called');
		return null;
	}
}
