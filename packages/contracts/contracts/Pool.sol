// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {ISuperfluid, ISuperToken, ISuperfluidToken, ISuperApp, ISuperAgreement, SuperAppDefinitions} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {SuperAppBase} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";
import {CFAv1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import "./libraries/sqrtLib.sol";
import "./interfaces/IAqueductHost.sol";
import "./interfaces/IAqueductToken.sol";
import "./interfaces/IFlowScheduler.sol";

contract Pool is SuperAppBase {
    /**************************************************************************
     * Pool/SuperApp state
     *************************************************************************/

    /* --- Superfluid --- */
    using CFAv1Library for CFAv1Library.InitData;
    CFAv1Library.InitData public cfaV1;
    bytes32 public constant CFA_ID = keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    IConstantFlowAgreementV1 cfa;
    ISuperfluid _host;

    // Useful constants
    uint256 e16 = 65536; // 2^16
    uint256 e32 = 4294967296; // 2^32

    /* --- Pool variables --- */
    address public factory;
    IAqueductToken public token0;
    IAqueductToken public token1;

    /* --- Automation --- */
    IFlowScheduler public flowScheduler;

    error STREAM_END_DATE_BEFORE_NOW();

    constructor(ISuperfluid host) payable {
        assert(address(host) != address(0));

        _host = host;
        factory = msg.sender;

        cfa = IConstantFlowAgreementV1(address(host.getAgreementClass(CFA_ID)));
        cfaV1 = CFAv1Library.InitData(host, cfa);

        uint256 configWord = SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);
    }

    // called once by the factory at time of deployment
    function initialize(IAqueductToken _token0, IAqueductToken _token1, IFlowScheduler _flowScheduler) external {
        require(msg.sender == factory, "FORBIDDEN"); // sufficient check
        token0 = _token0;
        token1 = _token1;
        flowScheduler = _flowScheduler;

        // Initial values for PoolConstants
        pc.F = 328; // 328/65536 = 0.0049896, so trading fee initially approx 0.5%
        pc.P = 1311; // 1310/65536 = 0.019989, so initially around 2% of trading fees accumulate in protocol. Protocol must maintain positive balances at all times.
        pc.M = 10; // M/N = 10, so liquidity providers get around 10x the rewards as traders
        pc.N = 1; // only ratio matters, so M=100 N=5 has same outcome as M=20 N=1
    }

    modifier onlyFactory() {
        require(msg.sender == address(factory), "Can only be called by factory");
        _;
    }

    // Update the protocol constants
    // This should take place only via the factory
    // Factory should only call this after a governance proposal passes
    // For example, reducing protocol fees and/or trading fees as volume increases in future
    function updateProtocolConstants(uint16 _f, uint16 _p, uint16 _m, uint16 _n) external onlyFactory {
        // When any of pool constants `pc` change, update anything that depends on them

        // 1. Obtain updated pool cumulative values, these are needed throughout calculation
        FlowCoeffs memory updatedPoolCumul = getUpdatedPoolCumul(block.timestamp);

        // 2. Update protocol constants
        pc.F = _f;
        pc.P = _p;
        pc.M = _m;
        pc.N = _n;

        // 3. Update pool state - PoolSums - only psm.D requires updating
        _setRewardSumD();

        // 4. Update pool state - PoolFlows
        _updatePoolFlows(updatedPoolCumul);

        // 5. Pool has streamed out tokens, settle the dynamic balances on token0, token1
        _settleBalances(address(this), updatedPoolCumul);
    }

    // Ability for owner to withdraw arbitrary Supertokens from the pool, e.g. withdraw pool earning
    // TODO: switch ISuperToken below to IERC20, which is more general
    // TODO: also consider functions to allow withdrawing of ETH/network coin, also arbitrary ERC721s.
    function withdrawToken(address _token) external onlyFactory {
        ISuperToken token = ISuperToken(_token);
        uint256 amount = token.balanceOf(address(this));
        token.transfer(msg.sender, amount);
    }

    /**************************************************************************
     * DCFA state
     *************************************************************************/

    // Use FlowCoeffs to store coefficients in the flow equations, either current values, or cumulative sums
    // User receives rate x of token A (token0), and rate y of token B (token1)
    // User streams in rates a, b of tokens A, B, plus liquidity c (see struct Incoming below)
    // Then, equations for x, y in terms of a, b, c have 6 coefficients
    // Two of these coeffs (a_x, b_y) are the same, call them 'ret'
    struct FlowCoeffs {
        // uint256 a_x = ret
        uint256 b_x;
        uint256 c_x;
        uint256 a_y;
        // uint256 b_y = ret
        uint256 c_y;
        uint256 ret;
    }

    // Use Incoming to store CFA flow rates in for either individual users or the pool as a whole
    struct Incoming {
        // Incoming CFA token flows
        uint256 a; // Rate of flowing token A in, per second
        uint256 b; // Rate of flowing token B in, per second
        // Incoming liquidity. Define liquidity c = sqrt(a*b)
        uint256 c; // Rate of flowing liquidity in, per second
    }

    // Use UserState to store all the state associated with an individual user/account.
    // User's state consists of:
    // - Their incoming rates
    // - A cache of pool cumulatives at the last time they made a change
    struct UserState {
        Incoming inc; // User flows in of a, b, c
        FlowCoeffs cumul; // Pool cumulatives at time of last user change
    }
    mapping(address => UserState) internal userStates;

    // Use PoolSums to store pool state associated with sums over user states
    struct PoolSums {
        Incoming inc; // Sum of user rates of incoming a, b, c
        uint256 D; // Sum of reward factors
        uint256 H; // equals sqrt(A*B), which doesn't equal C = sum(user.c)
        // Regime indicator is whether H>0 (we can trade) or H=0 (funds are returned to user)
    }
    PoolSums internal psm;

    // Use PoolFlows to store flow equation coefficients, both current, and cumulative sums at a timestamp
    struct PoolFlows {
        // Block timestamp of last update to accumulators
        uint256 T;
        // Cumulative flows in protocol, total units flowed up to T
        FlowCoeffs cumul;
        // Flow rates in tokens per second, multiplied by e32 = 2^32
        FlowCoeffs flow32;
    }
    PoolFlows internal pfl;

    // Use PoolConstants to store values that usually stay the same except for governance changes
    struct PoolConstants {
        // Control fees charged to traders and liquidity providers
        uint16 F; // all incoming streams get deducted a fee: F / 65536
        uint16 P; // protocol retains: fees * P / 65536
        // Control ratio of rewards to liquidity providers (M) and traders (N)
        // Suggest that M = 10*N is around right.
        // All that matters is M/N, e.g. M=20 N=2 gives same outcome as M=10 N=1
        uint16 M;
        uint16 N;
    }
    PoolConstants internal pc;

    /**************************************************************************
     * temp DCFA implementation
     *************************************************************************/

    function getCumulativeAtTime(
        uint256 newTime,
        uint256 oldTime,
        uint256 oldCumul, // total tokens flowed up to oldTime
        uint256 oldFlowRate32 // current flow rate in tokens per second between oldTime and newTime, multiplied by 2^32
    ) private view returns (uint256 c) {
        c = oldCumul + (oldFlowRate32 * (newTime - oldTime)) / e32;
    }

    // Calculate new cumulative FlowCoeffs, from new time and existing pool state
    function getUpdatedPoolCumul(uint256 newTime) private view returns (FlowCoeffs memory newCumul) {
        newCumul.b_x = getCumulativeAtTime(newTime, pfl.T, pfl.cumul.b_x, pfl.flow32.b_x);
        newCumul.c_x = getCumulativeAtTime(newTime, pfl.T, pfl.cumul.c_x, pfl.flow32.c_x);
        newCumul.a_y = getCumulativeAtTime(newTime, pfl.T, pfl.cumul.a_y, pfl.flow32.a_y);
        newCumul.c_y = getCumulativeAtTime(newTime, pfl.T, pfl.cumul.c_y, pfl.flow32.c_y);
        newCumul.ret = getCumulativeAtTime(newTime, pfl.T, pfl.cumul.ret, pfl.flow32.ret);
    }

    function getDynamicBalances(
        int8 sign,
        Incoming memory inc, // Incoming flow rates of user or pool between f0 and f1 snapshots
        FlowCoeffs memory f1, // cumulative FlowCoeffs at time we want balances
        FlowCoeffs memory f0 // cumulative FlowCoeffs at time of previous change of Incoming
    ) private pure returns (int256, int256) {
        uint256 xs = inc.a * (f1.ret - f0.ret) + inc.b * (f1.b_x - f0.b_x) + inc.c * (f1.c_x - f0.c_x);
        uint256 ys = inc.a * (f1.a_y - f0.a_y) + inc.b * (f1.ret - f0.ret) + inc.c * (f1.c_y - f0.c_y);
        return (int256(sign) * int256(xs), int256(sign) * int256(ys));
    }

    function realtimeBalances(
        address account,
        FlowCoeffs memory updatedPoolCumul
    ) private view returns (int256 dynamicBalance0, int256 dynamicBalance1) {
        int8 sign;
        Incoming memory inc;
        FlowCoeffs memory originalPoolCumul;
        if (account == address(this)) {
            // Dynamic balance of pool is negative since pool is sending out tokens
            sign = -1;
            inc = psm.inc;
            originalPoolCumul = pfl.cumul;
        } else {
            // Dynamic balance of user address is positive since user is receiving tokens back
            sign = 1;
            inc = userStates[account].inc;
            originalPoolCumul = userStates[account].cumul;
        }
        (dynamicBalance0, dynamicBalance1) = getDynamicBalances(sign, inc, updatedPoolCumul, originalPoolCumul);
    }

    function realtimeBalanceOf(
        ISuperfluidToken token,
        address account,
        uint256 time
    ) external view returns (int256 dynamicBalance, uint256 deposit, uint256 owedDeposit) {
        // // Have commented these out since 0 is default value
        // dynamicBalance = 0;
        // deposit = 0;
        // owedDeposit = 0;
        // // deposit and owedDeposit calculations have not been implemented yet

        // If token is neither token0 or token1, balances are zero, so return zeros
        if (address(token) != address(token0) && address(token) != address(token1)) {
            return (0, 0, 0);
        }

        FlowCoeffs memory updatedPoolCumul = getUpdatedPoolCumul(time);
        (int256 dynamicBalance0, int256 dynamicBalance1) = realtimeBalances(account, updatedPoolCumul);

        // Return the correct component
        if (address(token) == address(token0)) {
            dynamicBalance = dynamicBalance0;
        } else {
            // address(token) == address(token1)
            dynamicBalance = dynamicBalance1;
        }
    }

    function _updateUserState(address user, FlowCoeffs memory updatedPoolCumul) internal returns (Incoming memory) {
        // Store a copy of previous user Incoming values
        Incoming memory userPrevInc = userStates[user].inc;

        // Get updated CFA flows in - note although these are int96, they should always be positive or zero
        (, int96 _a_new, , ) = cfa.getFlow(token0, user, address(this));
        (, int96 _b_new, , ) = cfa.getFlow(token1, user, address(this));
        // Make new incoming values
        uint256 a_new = uint256(uint96(_a_new)); // TODO: need to Safecast this
        uint256 b_new = uint256(uint96(_b_new));
        uint256 c_new = sqrtLib.sqrt(a_new * b_new);
        // Store new incoming values, as well as updated pool cumulatives
        userStates[user].inc.a = a_new;
        userStates[user].inc.b = b_new;
        userStates[user].inc.c = c_new;
        userStates[user].cumul = updatedPoolCumul;

        return userPrevInc;
    }

    function _setRewardSumD() internal {
        psm.D = pc.M * psm.H * psm.inc.c + 2 * pc.N * psm.inc.a * psm.inc.b;
    }

    function _updatePoolSums(Incoming memory userPrevInc, Incoming memory userNewInc) internal {
        // Update the pool state PoolSums
        // TODO is it necessary to do each of these in 2 stages? otherwise overflow error?
        psm.inc.a = psm.inc.a - userPrevInc.a; // update flow of token0 (token A)
        psm.inc.a = psm.inc.a + userNewInc.a;
        psm.inc.b = psm.inc.b - userPrevInc.b; // update flow of token1 (token B)
        psm.inc.b = psm.inc.b + userNewInc.b;
        psm.inc.c = psm.inc.c - userPrevInc.c; // update flow of liquidity
        psm.inc.c = psm.inc.c + userNewInc.c;
        psm.H = sqrtLib.sqrt(psm.inc.a * psm.inc.b); // cache this square root
        _setRewardSumD();
    }

    function _updatePoolFlows(FlowCoeffs memory updatedPoolCumul) internal {
        // Cumulatives do not change within a block (eliminating many in-block MEV attacks)
        if (pfl.T < block.timestamp) {
            pfl.T = block.timestamp;
            pfl.cumul = updatedPoolCumul;
        }

        // Current flow rates can change within a block, and have two regimes
        if (psm.H > 0) {
            // Operating regime where both token0 and token1 are flowing in, so do streaming swap
            uint256 u = e16 * (e16 - pc.F); // (1 - Trading Fee) * 2^32
            uint256 v = pc.F * (e16 - pc.P); // Rewards * 2^32 = Trading Fee * (1 - Protocol Fee) * 2^32
            pfl.flow32.ret = (v * pc.N * psm.inc.a * psm.inc.b) / psm.D;
            pfl.flow32.c_x = (v * pc.M * psm.H * psm.inc.a) / psm.D; // Extra factor of e32 to remove later
            pfl.flow32.c_y = (v * pc.M * psm.H * psm.inc.b) / psm.D;
            pfl.flow32.a_y = (u * psm.inc.b) / psm.inc.a + (v * pc.N * psm.inc.b * psm.inc.b) / psm.D;
            pfl.flow32.b_x = (u * psm.inc.a) / psm.inc.b + (v * pc.N * psm.inc.a * psm.inc.a) / psm.D;
        } else {
            // Degenerate regime where total flow of either token0 or token1 (or both) is zero, so return all funds
            pfl.flow32.b_x = 0;
            pfl.flow32.c_x = 0;
            pfl.flow32.a_y = 0;
            pfl.flow32.c_y = 0;
            pfl.flow32.ret = e32; // Will divide out e32 again later
        }
    }

    function _settleBalances(address addr, FlowCoeffs memory updatedPoolCumul) internal {
        (int256 diff0, int256 diff1) = realtimeBalances(addr, updatedPoolCumul);
        token0.settleBalance(addr, diff0);
        token1.settleBalance(addr, diff1);
    }

    // Currently this will be called when a user creates, updates, or deletes
    // an incoming stream of token0 or token1
    // TODO: There may also be protocol changes to parameters to consider
    function _handleCallback(ISuperToken _superToken, bytes calldata _agreementData) internal {
        require(
            address(_superToken) == address(token0) || address(_superToken) == address(token1),
            "RedirectAll: token not in pool"
        );

        // 1. Get address of user that has updated their CFA flows into this contract
        (address user, ) = abi.decode(_agreementData, (address, address));

        // 2. Obtain updated pool cumulative values, these are needed throughout calculation
        FlowCoeffs memory updatedPoolCumul = getUpdatedPoolCumul(block.timestamp);

        // 3. Update user's state
        Incoming memory userPrevInc = _updateUserState(user, updatedPoolCumul);

        // 4. Update pool state - PoolSums
        Incoming memory userNewInc = userStates[user].inc;
        _updatePoolSums(userPrevInc, userNewInc);

        // 5. Update pool state - PoolFlows
        _updatePoolFlows(updatedPoolCumul);

        // 6. Pool has streamed out tokens, settle the dynamic balances on token0, token1
        _settleBalances(address(this), updatedPoolCumul);

        // 7. Users have received tokens, settle the dynamic balances on the tokens
        _settleBalances(user, updatedPoolCumul);
    }

    function createFlowSchedule(ISuperToken _superToken, address _sender, uint256 _endDate) internal {
        if (_endDate <= block.timestamp) revert STREAM_END_DATE_BEFORE_NOW();

        _grantFlowOperatorPermissions(address(_superToken), address(flowScheduler));

        flowScheduler.createFlowSchedule(
            _superToken,
            address(this), // stream receiver
            uint32(0), // start date
            uint32(0), // start date max delay
            int96(0), // flow rate
            uint256(0), // start amount
            uint32(_endDate),
            "0x",
            "0x"
        );
    }

    /**
     * @param _flowSuperToken Super token address
     * @param _flowOperator The permission grantee address
     */
    function _grantFlowOperatorPermissions(address _flowSuperToken, address _flowOperator) internal {
        _host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    IAqueductToken(_flowSuperToken),
                    _flowOperator,
                    4, // bitmask representation of delete
                    0, // flow rate allowance
                    new bytes(0) // ctx
                )
            ),
            "0x"
        );
    }

    // TODO
    // before Agreement Created / Updated / Deleted (or could this be in the After?)
    // raise error if it is not a CFA (e.g. an IDA or something else...)
    //  - probably from _agreementData
    // raise error if CFA magnitudes are out of bounds, e.g. if `a` is a uint256 but not uint128 we get overflow on calc of `c`
    // (there  may be other cases!)

    function afterAgreementCreated(
        ISuperToken _superToken,
        address, //_agreementClass,
        bytes32, //_agreementId
        bytes calldata _agreementData,
        bytes calldata, //_cbdata,
        bytes calldata _ctx
    ) external override onlyHost returns (bytes memory newCtx) {
        _handleCallback(_superToken, _agreementData);

        // ISuperfluid.Context memory context = _host.decodeCtx(_ctx);
        // uint256 endDate = abi.decode(context.userData, (uint256));
        // if (endDate != 0) {
        //     createFlowSchedule(_superToken, context.msgSender, endDate);
        // }

        newCtx = _ctx;
    }

    function afterAgreementUpdated(
        ISuperToken _superToken,
        address, //_agreementClass,
        bytes32, // _agreementId,
        bytes calldata _agreementData,
        bytes calldata, //_cbdata,
        bytes calldata _ctx
    ) external override onlyHost returns (bytes memory newCtx) {
        _handleCallback(_superToken, _agreementData);

        // ISuperfluid.Context memory context = _host.decodeCtx(_ctx);
        // uint256 endDate = abi.decode(context.userData, (uint256));
        // if (endDate != 0) {
        //     createFlowSchedule(_superToken, context.msgSender, endDate);
        // }

        newCtx = _ctx;
    }

    function afterAgreementTerminated(
        ISuperToken _superToken,
        address, //_agreementClass,
        bytes32, // _agreementId,
        bytes calldata _agreementData,
        bytes calldata, //_cbdata,
        bytes calldata _ctx
    ) external override onlyHost returns (bytes memory newCtx) {
        _handleCallback(_superToken, _agreementData);
        newCtx = _ctx;
    }

    modifier onlyHost() {
        require(msg.sender == address(cfaV1.host), "RedirectAll: support only one host");
        _;
    }
}
