# 🎯 Security Features Testing Guide

## ✅ **Installation Complete!**
The SQL security functions have been successfully installed. Now let's test everything works.

## 🧪 **Step 1: Test SQL Functions**
1. **Run the test script** in Supabase SQL Editor:
   - Open `TEST_SECURITY_FUNCTIONS.sql`
   - Execute to verify all functions work
   - Should show security questions and function results

## 🚀 **Step 2: Test Anti-Brute-Force Protection**
1. **User Login Testing:**
   - Try logging in with wrong PIN 5 times
   - On 6th attempt, should see "Account temporarily locked" message
   - Wait 15 minutes or check `unihub_security_logs` table

2. **Driver Login Testing:**
   - Try driver login with wrong PIN 5 times  
   - Should lock after 5 attempts
   - Check driver status becomes locked

## 🔐 **Step 3: Test PIN Reset Features**
1. **User PIN Reset:**
   - Click "Forgot PIN?" on user login
   - Enter phone number
   - Select security question
   - Enter answer and new 4-digit PIN
   - Should show "PIN reset successful" message

2. **Driver PIN Reset:**
   - Click "Forgot PIN?" on driver login
   - Enter driver ID
   - Select security question
   - Enter answer and new 4-digit PIN
   - Should show "Driver PIN reset successful" message

## 📊 **Step 4: Verify Security Logs**
Check the security logs table:
```sql
SELECT * FROM unihub_security_logs ORDER BY created_at DESC LIMIT 10;
```

Should show:
- Login attempts (success/failed)
- IP addresses
- User agents
- Attempt types (user_login, driver_login)

## 🔍 **Step 5: Test Security Questions**
Verify security questions are available:
```sql
SELECT * FROM security_questions WHERE is_active = true;
```

Should show 5 default questions:
1. What was your childhood nickname?
2. What is your mother's maiden name?
3. What was the name of your first pet?
4. What city were you born in?
5. What is your favorite food?

## ⚠️ **Troubleshooting**

### If PIN Reset Doesn't Work:
1. Check if user has security answers set:
   ```sql
   SELECT * FROM user_security_answers WHERE user_id = 'USER_PHONE';
   ```

2. Set up security answers manually if needed:
   ```sql
   INSERT INTO user_security_answers (user_id, question_id, answer_hash)
   VALUES ('USER_PHONE', 'QUESTION_UUID', 'ANSWER');
   ```

### If Anti-Brute-Force Doesn't Work:
1. Check security logs:
   ```sql
   SELECT * FROM unihub_security_logs WHERE status = 'failed';
   ```

2. Check if functions exist:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE '%login%';
   ```

## 🎉 **Success Indicators**
✅ Anti-brute-force locks account after 5 failed attempts
✅ PIN reset works via security questions  
✅ Security logs track all login attempts
✅ "Forgot PIN?" buttons appear and work
✅ No SQL errors in console
✅ All functions execute successfully

## 📝 **Next Steps**
1. **Test all features** using this guide
2. **Set up security answers** for test users
3. **Monitor security logs** for activity
4. **Customize security questions** if needed
5. **Adjust lock duration** (currently 15 minutes) if desired

## 🛠️ **Customization Options**
- Change max attempts: Modify `max_attempts` in functions
- Change lock duration: Modify `lock_duration_minutes` 
- Add security questions: Insert into `security_questions` table
- Customize lock messages: Update React alert messages

**🚀 Your security system is now fully operational!**
